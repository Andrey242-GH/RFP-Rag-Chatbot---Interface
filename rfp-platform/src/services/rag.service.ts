/**
 * RAG Service — orchestrates the full pipeline:
 *   1. Retrieve relevant knowledge (hybrid vector + keyword search)
 *   2. Generate answers (Bedrock via Next.js API route)
 *   3. Evaluate answers independently
 *   4. Aggregate into a full proposal
 *
 * The generation and evaluation models are DIFFERENT (hallucination prevention).
 * The frontend calls Next.js API routes; AWS calls happen server-side only.
 */
import { get, post, patch } from "@/lib/api-client";
import type {
  ApiResponse,
  GeneratedAnswer,
  AnswerEvaluation,
  RetrievalResult,
  ExtractedQuestion,
  Proposal,
  BedrockModelId,
} from "@/types";

// ─── Generation ───────────────────────────────────────────────

export interface GenerateAnswerPayload {
  rfpId: string;
  questionId: string;
  /** Override the default generation model for this request */
  modelId?: BedrockModelId;
}

export async function generateAnswer(
  payload: GenerateAnswerPayload
): Promise<ApiResponse<GeneratedAnswer>> {
  return post("/proposals/generate-answer", payload);
}

export async function generateAllAnswers(rfpId: string): Promise<
  ApiResponse<{
    proposalId: string;
    totalQuestions: number;
    jobId: string;
  }>
> {
  return post("/proposals/generate-all", { rfpId });
}

export async function getGenerationStatus(jobId: string): Promise<
  ApiResponse<{
    status: "pending" | "running" | "complete" | "failed";
    completed: number;
    total: number;
    answersReady: GeneratedAnswer[];
  }>
> {
  return get(`/proposals/generation-status/${jobId}`);
}

// ─── Retrieval ────────────────────────────────────────────────

export async function retrieveContext(params: {
  question: string;
  industry?: string;
  region?: string;
  topK?: number;
}): Promise<ApiResponse<RetrievalResult>> {
  return post("/knowledge/retrieve", params);
}

// ─── Evaluation ───────────────────────────────────────────────

export async function evaluateAnswer(answerId: string): Promise<ApiResponse<AnswerEvaluation>> {
  return post(`/proposals/evaluate/${answerId}`);
}

export async function evaluateAllAnswers(
  proposalId: string
): Promise<ApiResponse<{ jobId: string }>> {
  return post(`/proposals/${proposalId}/evaluate-all`);
}

// ─── Answer editing (human-in-the-loop) ──────────────────────

export interface EditAnswerPayload {
  content: string;
  changeNote?: string;
}

export async function saveAnswerEdit(
  answerId: string,
  payload: EditAnswerPayload
): Promise<ApiResponse<GeneratedAnswer>> {
  return patch(`/proposals/answers/${answerId}`, payload);
}

export async function revertAnswerToAI(answerId: string): Promise<ApiResponse<GeneratedAnswer>> {
  return post(`/proposals/answers/${answerId}/revert`);
}

export async function revertAnswerToVersion(
  answerId: string,
  versionNumber: number
): Promise<ApiResponse<GeneratedAnswer>> {
  return post(`/proposals/answers/${answerId}/revert/${versionNumber}`);
}

// ─── Proposal assembly ───────────────────────────────────────

export async function assembleProposal(rfpId: string): Promise<ApiResponse<Proposal>> {
  return post("/proposals/assemble", { rfpId });
}

export async function getProposal(proposalId: string): Promise<ApiResponse<Proposal>> {
  return get(`/proposals/${proposalId}`);
}

export async function updateProposalSection(
  proposalId: string,
  sectionId: string,
  content: string
): Promise<ApiResponse<Proposal>> {
  return patch(`/proposals/${proposalId}/sections/${sectionId}`, { content });
}

// ─── Export ───────────────────────────────────────────────────

export type ExportFormat = "pdf" | "docx" | "txt";

export async function exportProposal(
  proposalId: string,
  format: ExportFormat
): Promise<ApiResponse<{ downloadUrl: string; expiresAt: string }>> {
  return post(`/proposals/${proposalId}/export`, { format });
}

// ─── Outcome tracking (feedback loop) ────────────────────────

export async function markProposalOutcome(
  proposalId: string,
  outcome: "approved" | "rejected",
  feedback?: string
): Promise<ApiResponse<{ knowledgeRecordsAdded: number }>> {
  return post(`/proposals/${proposalId}/outcome`, { outcome, feedback });
}

// ─── Chat / interactive RAG ───────────────────────────────────

export interface ChatPayload {
  sessionId?: string;
  message: string;
  rfpId?: string;
  proposalId?: string;
  context?: {
    questionId?: string;
    industry?: string;
  };
}

export interface ChatResponse {
  sessionId: string;
  messageId: string;
  content: string;
  confidenceScore: number;
  sources: RetrievalResult["sources"];
  relatedApprovedResponses: unknown[];
}

export async function sendChatMessage(
  payload: ChatPayload
): Promise<ApiResponse<ChatResponse>> {
  return post("/chat", payload);
}

export async function getChatHistory(sessionId: string): Promise<
  ApiResponse<{
    session: { id: string; rfpId?: string; createdAt: string };
    messages: unknown[];
  }>
> {
  return get(`/chat/${sessionId}`);
}

// ─── Question re-generation ───────────────────────────────────
export async function regenerateAnswer(
  answerId: string,
  instructions?: string
): Promise<ApiResponse<GeneratedAnswer>> {
  return post(`/proposals/answers/${answerId}/regenerate`, { instructions });
}

// ─── Questions list for a proposal ───────────────────────────
export async function getProposalQuestions(
  rfpId: string
): Promise<ApiResponse<ExtractedQuestion[]>> {
  return get(`/rfp/${rfpId}/questions`);
}
