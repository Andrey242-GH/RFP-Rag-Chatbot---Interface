/**
 * POST /api/proposals/generate-all
 *
 * Generates answers for all questions in an RFP sequentially.
 * For demo environments this runs synchronously.
 * In production, replace with SQS + Lambda for parallel async processing.
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { listQuestionsByRfpId } from "@/lib/dal/questions";
import { getRFPById } from "@/lib/dal/rfp";
import { generateEmbedding, invokeModel, GENERATION_MODEL } from "@/lib/bedrock";
import { hybridSearch, toRetrievedSources, computeRetrievalQualityScore } from "@/lib/opensearch";
import { buildGenerationPrompt, GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { createAnswer } from "@/lib/dal/answers";
import type { RetrievalResult } from "@/types";

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const _userId = headersList.get("x-user-id") ?? "system";

  try {
    const body = await request.json() as { rfpId?: string; modelId?: string };

    if (!body.rfpId) {
      return Response.json({ success: false, message: "rfpId is required" }, { status: 400 });
    }

    const questions = await listQuestionsByRfpId(body.rfpId);
    if (questions.length === 0) {
      return Response.json(
        { success: false, message: "No questions found for this RFP. Has it been processed?" },
        { status: 422 }
      );
    }

    const rfp = await getRFPById(body.rfpId);
    const rfpMetadata = rfp?.metadata;
    const modelId = body.modelId ?? GENERATION_MODEL;

    const generatedAnswerIds: string[] = [];
    const errors: string[] = [];

    for (const question of questions) {
      try {
        // Generate embedding for the question
        const queryVector = await generateEmbedding(question.question);

        // Hybrid search
        const hits = await hybridSearch({
          queryVector,
          queryText: question.question,
          topK: 5,
          industry: rfpMetadata?.industry,
        });

        const sources = toRetrievedSources(hits);
        const retrievalQualityScore = computeRetrievalQualityScore(hits);

        const retrievalResult: RetrievalResult = {
          sources,
          retrievalQualityScore,
          hybridSearchUsed: true,
          vectorScore: hits.length > 0 ? hits[0].vectorScore : 0,
          keywordScore: hits.length > 0 ? hits[0].keywordScore : 0,
        };

        // Build prompt and generate
        const contextText = sources
          .map((s, i) => `[Source ${i + 1}]\n${s.content}`)
          .join("\n\n---\n\n");

        const userPrompt = buildGenerationPrompt(
          question.question,
          contextText,
          rfpMetadata
            ? { industry: rfpMetadata.industry, client: rfpMetadata.client, region: rfpMetadata.region }
            : undefined
        );

        const aiGeneratedContent = await invokeModel({
          modelId,
          systemPrompt: GENERATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          maxTokens: 2048,
          temperature: 0.3,
        });

        const answer = await createAnswer({
          rfpId: body.rfpId!,
          questionId: question.id,
          question: question.question,
          aiGeneratedContent,
          retrievalResult,
          modelId,
          promptVersion: "v1",
        });

        generatedAnswerIds.push(answer.id);
      } catch (qErr) {
        console.error(`Failed to generate answer for question ${question.id}:`, qErr);
        errors.push(question.id);
      }
    }

    return Response.json(
      {
        success: true,
        data: {
          rfpId: body.rfpId,
          totalQuestions: questions.length,
          generated: generatedAnswerIds.length,
          failed: errors.length,
          answerIds: generatedAnswerIds,
        },
      },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start generation";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
