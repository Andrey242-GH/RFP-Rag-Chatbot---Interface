/**
 * POST /api/proposals/answers/[answerId]/regenerate
 * Re-generates an answer with optional instructions.
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getAnswerById, saveHumanEdit } from "@/lib/dal/answers";
import { generateEmbedding, invokeModel, GENERATION_MODEL } from "@/lib/bedrock";
import { hybridSearch, toRetrievedSources, computeRetrievalQualityScore } from "@/lib/opensearch";
import { buildGenerationPrompt, GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { db, TABLES } from "@/lib/dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { RetrievalResult } from "@/types";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/proposals/answers/[answerId]/regenerate">
) {
  const { answerId } = await ctx.params;
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";

  try {
    const body = await request.json().catch(() => ({})) as {
      instructions?: string;
      modelId?: string;
    };

    const answer = await getAnswerById(answerId);
    if (!answer) {
      return Response.json({ success: false, message: "Answer not found" }, { status: 404 });
    }

    const modelId = body.modelId ?? GENERATION_MODEL;

    // Re-retrieve context
    const queryVector = await generateEmbedding(answer.question);
    const hits = await hybridSearch({ queryVector, queryText: answer.question, topK: 5 });
    const sources = toRetrievedSources(hits);
    const retrievalQualityScore = computeRetrievalQualityScore(hits);

    const contextText = sources
      .map((s, i) => `[Source ${i + 1}]\n${s.content}`)
      .join("\n\n---\n\n");

    // Include regeneration instructions in the prompt
    const basePrompt = buildGenerationPrompt(answer.question, contextText);
    const fullPrompt = body.instructions
      ? `${basePrompt}\n\nADDITIONAL INSTRUCTIONS:\n${body.instructions}`
      : basePrompt;

    const newContent = await invokeModel({
      modelId,
      systemPrompt: GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: fullPrompt }],
      maxTokens: 2048,
      temperature: 0.4, // Slightly higher for variation
    });

    // Update the AI-generated content and reset active version to "ai"
    const retrievalResult: RetrievalResult = {
      sources,
      retrievalQualityScore,
      hybridSearchUsed: true,
      vectorScore: hits.length > 0 ? hits[0].vectorScore : 0,
      keywordScore: hits.length > 0 ? hits[0].keywordScore : 0,
    };

    await db.send(
      new UpdateCommand({
        TableName: TABLES.ANSWERS,
        Key: { id: answerId },
        UpdateExpression:
          "SET aiGeneratedContent = :content, activeVersion = :ver, retrievalResult = :rr, modelId = :mid, updatedAt = :now",
        ExpressionAttributeValues: {
          ":content": newContent,
          ":ver": "ai",
          ":rr": retrievalResult,
          ":mid": modelId,
          ":now": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(id)",
      })
    );

    const updated = await getAnswerById(answerId);
    return Response.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to regenerate answer";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
