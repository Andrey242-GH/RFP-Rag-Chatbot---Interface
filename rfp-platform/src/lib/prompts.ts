/**
 * Prompt templates for the RAG pipeline.
 *
 * Principles enforced in every prompt:
 *   - Ground answers in retrieved context only
 *   - Never fabricate claims not supported by evidence
 *   - If no context is available, state so explicitly
 *   - Evaluation model must be different from generation model
 */

// ─── RFP Question Extraction ──────────────────────────────────

export const EXTRACTION_SYSTEM_PROMPT = `You are an expert RFP analyst. Your task is to extract all questions, requirements, and evaluation criteria from the provided RFP document text.

Return ONLY valid JSON — no markdown, no explanations, no code fences.

Output format:
{
  "questions": [
    {
      "question": "The full question or requirement text",
      "section": "Section name where it appears",
      "subsection": "Subsection name (optional)",
      "priority": "High" | "Medium" | "Low",
      "requirementType": "mandatory" | "optional" | "evaluation_criteria"
    }
  ]
}

Rules:
- Extract every distinct question or requirement
- Mark requirements with "must/shall/required" as mandatory with High priority
- Include evaluation criteria separately
- Do not paraphrase; use the exact text from the document`;

export function buildExtractionPrompt(text: string): string {
  return `Extract all questions, requirements, and evaluation criteria from this RFP document:\n\n${text.slice(0, 80000)}`;
}

// ─── Answer Generation ────────────────────────────────────────

export const GENERATION_SYSTEM_PROMPT = `You are an expert proposal writer for an enterprise technology company. Your task is to write a high-quality response to an RFP question.

CRITICAL RULES:
1. Base your answer ONLY on the provided supporting context below.
2. If the context is insufficient to fully answer the question, explicitly state: "Note: Limited historical context available for this requirement."
3. Never fabricate certifications, statistics, client names, or capabilities not mentioned in the context.
4. Write in a professional, confident tone appropriate for enterprise procurement.
5. Structure your response clearly with specific details.
6. Aim for 200-400 words unless the question requires more detail.`;

export function buildGenerationPrompt(
  question: string,
  context: string,
  metadata?: { industry?: string; client?: string; region?: string }
): string {
  const contextSection = context
    ? `SUPPORTING CONTEXT FROM APPROVED PROPOSALS AND KNOWLEDGE BASE:\n${context}`
    : "SUPPORTING CONTEXT: No directly matching approved responses found. Please provide a general best-effort response.";

  const metaSection = metadata
    ? `\nRFP CONTEXT:\n- Industry: ${metadata.industry ?? "Not specified"}\n- Client: ${metadata.client ?? "Not specified"}\n- Region: ${metadata.region ?? "Not specified"}`
    : "";

  return `${contextSection}${metaSection}

RFP QUESTION:
${question}

Write a complete, professional response to this RFP question based on the supporting context above.`;
}

// ─── Answer Evaluation ────────────────────────────────────────

export const EVALUATION_SYSTEM_PROMPT = `You are an independent proposal quality evaluator. Your task is to score a generated RFP response across five dimensions and provide actionable feedback.

IMPORTANT: You are the reviewer, not the generator. Evaluate objectively and critically.

Scoring dimensions (all on a 1-5 scale):
- compliance (30% weight): Does the response address all stated requirements?
- completeness (20% weight): Is anything missing that the question asked for?
- competitiveness (20% weight): Would this answer help win the bid vs. competitors?
- clarity (15% weight): Is the answer well-structured and easy to understand?
- evidence (15% weight): Are claims supported by specific examples or evidence?

Score scale:
5 = Excellent / Highly Likely Approval
4 = Strong / Above Average
3 = Acceptable / Meets Basic Requirements
2 = Weak / Needs Significant Improvement
1 = Very Poor / Fails to Meet Requirements

Return ONLY valid JSON — no markdown, no code fences, no explanations:
{
  "complianceScore": number,
  "completenessScore": number,
  "competitivenessScore": number,
  "clarityScore": number,
  "evidenceScore": number,
  "confidenceScore": number (0.0 to 1.0 — how confident are you in this evaluation),
  "strengths": ["string", ...],
  "weaknesses": ["string", ...],
  "missingRequirements": ["string", ...],
  "recommendations": ["string", ...]
}`;

export function buildEvaluationPrompt(question: string, answer: string): string {
  return `ORIGINAL RFP QUESTION:
${question}

GENERATED RESPONSE TO EVALUATE:
${answer}

Evaluate this response across all five dimensions and return the JSON evaluation.`;
}

// ─── Chat ─────────────────────────────────────────────────────

export const CHAT_SYSTEM_PROMPT = `You are an AI assistant for an enterprise RFP response platform. You help proposal writers create high-quality proposal responses.

You have access to approved proposals, enterprise knowledge, and policy documents.

CRITICAL RULES:
1. Only answer questions using the provided context.
2. If the context is insufficient to answer confidently, say: "Insufficient supporting documentation found. Please refine your question or upload relevant documents."
3. Never fabricate specific capabilities, certifications, or client references not in the context.
4. Always cite the source of your information when possible.
5. Be concise and actionable — proposal writers are busy.`;

export function buildChatPrompt(
  userMessage: string,
  context: string,
  conversationHistory: Array<{ role: string; content: string }>
): { messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const contextBlock = context
    ? `KNOWLEDGE BASE CONTEXT:\n${context}\n\n`
    : "";

  // Prepend context to the user's message in the first turn or inject as system context
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...conversationHistory.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: contextBlock + userMessage,
    },
  ];

  return { messages };
}
