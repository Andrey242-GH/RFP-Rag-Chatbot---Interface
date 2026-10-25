/**
 * POST /api/proposals/generate-answer
 *
 * Full RAG pipeline for a single question:
 *   1. Fetch question from DynamoDB
 *   2. Generate query embedding (Bedrock Titan Embed)
 *   3. Hybrid OpenSearch search (KNN + BM25 + quality boost)
 *   4. Build grounded prompt with retrieved context
 *   5. Invoke Bedrock Claude (generation model) to produce an answer
 *   6. Store GeneratedAnswer in DynamoDB
 *   7. Return the answer
 *
 * The evaluation step is a separate endpoint (generator ≠ reviewer).
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getQuestionById } from "@/lib/dal/questions";
import { getRFPById } from "@/lib/dal/rfp";
import { createAnswer } from "@/lib/dal/answers";
import { generateEmbedding, invokeModel, GENERATION_MODEL } from "@/lib/bedrock";
import { hybridSearch, toRetrievedSources, computeRetrievalQualityScore } from "@/lib/opensearch";
import { buildGenerationPrompt, GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import type { RetrievalResult } from "@/types";

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";

  try {
    const body = await request.json() as {
      rfpId?: string;
      questionId?: string;
      modelId?: string;
    };

    if (!body.rfpId || !body.questionId) {
      return Response.json(
        { success: false, message: "rfpId and questionId are required" },
        { status: 400 }
      );
    }

    const modelId = body.modelId ?? GENERATION_MODEL;

    // 1. Fetch the question
    const question = await getQuestionById(body.questionId);
    if (!question) {
      return Response.json(
        { success: false, message: `Question ${body.questionId} not found` },
        { status: 404 }
      );
    }

    // 2. Fetch RFP metadata for context
    const rfp = await getRFPById(body.rfpId);
    const rfpMetadata = rfp?.metadata;

    // 3. Generate query embedding
    const queryVector = await generateEmbedding(question.question);

    // 4. Hybrid search OpenSearch
    const searchHits = await hybridSearch({
      queryVector,
      queryText: question.question,
      topK: 5,
      industry: rfpMetadata?.industry,
    });

    const sources = toRetrievedSources(searchHits);
    const retrievalQualityScore = computeRetrievalQualityScore(searchHits);
    const vectorScore =
      searchHits.length > 0
        ? searchHits.reduce((s, h) => s + h.vectorScore, 0) / searchHits.length
        : 0;
    const keywordScore =
      searchHits.length > 0
        ? searchHits.reduce((s, h) => s + h.keywordScore, 0) / searchHits.length
        : 0;

    const retrievalResult: RetrievalResult = {
      sources,
      retrievalQualityScore,
      hybridSearchUsed: true,
      vectorScore,
      keywordScore,
    };

    // 5. Build grounded prompt
    const contextText = sources
      .map(
        (s, i) =>
          `[Source ${i + 1} — Quality Level ${s.qualityLevel}, ${s.metadata.industry ?? "General"}]\n${s.content}`
      )
      .join("\n\n---\n\n");

    const userPrompt = buildGenerationPrompt(
      question.question,
      contextText,
      rfpMetadata
        ? {
            industry: rfpMetadata.industry,
            client: rfpMetadata.client,
            region: rfpMetadata.region,
          }
        : undefined
    );

    // 6. Invoke Bedrock
    const aiGeneratedContent = await invokeModel({
      modelId,
      systemPrompt: GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 2048,
      temperature: 0.3,
    });

    // 7. Store in DynamoDB
    const answer = await createAnswer({
      rfpId: body.rfpId,
      questionId: body.questionId,
      question: question.question,
      aiGeneratedContent,
      retrievalResult,
      modelId,
      promptVersion: "v1",
    });

    return Response.json({ success: true, data: answer }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate answer";
    console.error("generate-answer error:", err);
    return Response.json({ success: false, message }, { status: 500 });
  }
}
