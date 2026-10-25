/**
 * POST /api/proposals/evaluate/[answerId]
 *
 * Independent evaluation — uses BEDROCK_EVALUATION_MODEL (Claude Opus),
 * NOT the generation model (Claude Sonnet). Generator ≠ Reviewer.
 *
 * Scoring dimensions (weighted):
 *   compliance      30%
 *   completeness    20%
 *   competitiveness 20%
 *   clarity         15%
 *   evidence        15%
 */
import { type NextRequest } from "next/server";
import { getAnswerById, saveEvaluation } from "@/lib/dal/answers";
import { invokeModel, EVALUATION_MODEL } from "@/lib/bedrock";
import { buildEvaluationPrompt, EVALUATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { calculateWeightedScore } from "@/lib/utils";
import type { AnswerEvaluation } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { SCORE_WEIGHTS } from "@/lib/constants";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/proposals/evaluate/[answerId]">
) {
  const { answerId } = await ctx.params;

  try {
    // 1. Fetch answer from DynamoDB
    const answer = await getAnswerById(answerId);
    if (!answer) {
      return Response.json(
        { success: false, message: `Answer ${answerId} not found` },
        { status: 404 }
      );
    }

    const activeContent =
      answer.activeVersion === "human" && answer.humanEditedContent
        ? answer.humanEditedContent
        : answer.aiGeneratedContent;

    // 2. Build evaluation prompt — uses evaluation model, not generation model
    const userPrompt = buildEvaluationPrompt(answer.question, activeContent);

    // 3. Call Bedrock with EVALUATION model (Claude Opus — different from generator)
    const raw = await invokeModel({
      modelId: EVALUATION_MODEL,
      systemPrompt: EVALUATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 2048,
      temperature: 0.1, // Low temperature for consistent scoring
    });

    // 4. Parse structured JSON from model response
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      complianceScore: number;
      completenessScore: number;
      competitivenessScore: number;
      clarityScore: number;
      evidenceScore: number;
      confidenceScore: number;
      strengths: string[];
      weaknesses: string[];
      missingRequirements: string[];
      recommendations: string[];
    };

    // Clamp all scores to 1-5 range
    const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n * 10) / 10));

    const scores = {
      compliance: clamp(parsed.complianceScore),
      completeness: clamp(parsed.completenessScore),
      competitiveness: clamp(parsed.competitivenessScore),
      clarity: clamp(parsed.clarityScore),
      evidence: clamp(parsed.evidenceScore),
    };

    const approvalScore = Math.round(calculateWeightedScore(scores) * 10) / 10;

    // 5. Build and store evaluation
    const evaluation: AnswerEvaluation = {
      id: `eval_${uuidv4()}`,
      answerId,
      approvalScore,
      complianceScore: scores.compliance,
      completenessScore: scores.completeness,
      competitivenessScore: scores.competitiveness,
      clarityScore: scores.clarity,
      evidenceScore: scores.evidence,
      confidenceScore: Math.min(1, Math.max(0, parsed.confidenceScore)),
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      missingRequirements: parsed.missingRequirements ?? [],
      recommendations: parsed.recommendations ?? [],
      evaluationModelId: EVALUATION_MODEL,
      evaluatedAt: new Date().toISOString(),
    };

    await saveEvaluation(answerId, evaluation);

    return Response.json({ success: true, data: evaluation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed";
    console.error("evaluate error:", err);
    return Response.json({ success: false, message }, { status: 500 });
  }
}
