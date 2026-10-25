// ============================================================
// Core Domain Types — Enterprise RFP Response Platform
// ============================================================

// ─── User & Auth ────────────────────────────────────────────

export type UserRole = "admin" | "proposal_writer" | "reviewer" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  createdAt: string;
  lastLoginAt?: string;
}

// ─── RFP Document ───────────────────────────────────────────

export type RFPStatus =
  | "uploading"
  | "processing"
  | "extracted"
  | "generating"
  | "draft"
  | "in_review"
  | "submitted"
  | "approved"
  | "rejected"
  | "archived";

export interface RFPMetadata {
  client: string;
  industry: string;
  region: string;
  submissionDate: string;
  estimatedValue?: number;
  currency?: string;
  tags?: string[];
}

export interface RFPDocument {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: "pdf" | "docx" | "txt";
  s3Key: string;
  metadata: RFPMetadata;
  status: RFPStatus;
  uploadedBy: string;
  uploadedAt: string;
  processedAt?: string;
  pageCount?: number;
  extractionJobId?: string;
}

// ─── Question Extraction ─────────────────────────────────────

export type QuestionPriority = "High" | "Medium" | "Low";

export interface ExtractedQuestion {
  id: string;
  rfpId: string;
  question: string;
  section: string;
  subsection?: string;
  priority: QuestionPriority;
  requirementType: "mandatory" | "optional" | "evaluation_criteria";
  pageNumber?: number;
  orderIndex: number;
}

// ─── Knowledge Base ──────────────────────────────────────────

/**
 * Quality levels drive retrieval weighting.
 * Level 5 (Customer Approved + Strategic) gets the highest boost.
 */
export type KnowledgeQualityLevel = 1 | 2 | 3 | 4 | 5;

export type KnowledgeDomain = "rfp" | "hr" | "policy" | "security" | "general";

export interface KnowledgeRecord {
  id: string;
  question: string;
  answer: string;
  industry: string;
  customer: string;
  region: string;
  proposalStatus: "approved" | "rejected" | "submitted" | "human_reviewed" | "ai_generated";
  qualityLevel: KnowledgeQualityLevel;
  domain: KnowledgeDomain;
  approvalDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  embeddingId?: string;
  tags?: string[];
  isStrategicCustomer?: boolean;
}

// ─── RAG Retrieval ───────────────────────────────────────────

export interface RetrievedSource {
  id: string;
  knowledgeRecordId: string;
  content: string;
  relevanceScore: number;
  qualityLevel: KnowledgeQualityLevel;
  sourceType: "approved_proposal" | "template" | "enterprise_knowledge";
  metadata: {
    customer?: string;
    industry?: string;
    proposalStatus?: string;
    approvalDate?: string;
  };
}

export interface RetrievalResult {
  sources: RetrievedSource[];
  retrievalQualityScore: number;
  hybridSearchUsed: boolean;
  vectorScore: number;
  keywordScore: number;
}

// ─── Response Generation ─────────────────────────────────────

export interface GeneratedAnswer {
  id: string;
  rfpId: string;
  questionId: string;
  question: string;

  // The AI-generated version (immutable once created)
  aiGeneratedContent: string;

  // The human-edited version (mutable)
  humanEditedContent?: string;

  // Which version is currently "active"
  activeVersion: "ai" | "human";

  // Full version history for rollback
  versionHistory: AnswerVersion[];

  // RAG metadata
  retrievalResult: RetrievalResult;
  modelId: string;
  promptVersion: string;

  // Evaluation
  evaluation?: AnswerEvaluation;

  // State
  status: "generating" | "generated" | "reviewed" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface AnswerVersion {
  versionNumber: number;
  content: string;
  editedBy: string;
  editedAt: string;
  changeNote?: string;
}

// ─── Evaluation & Scoring ─────────────────────────────────────

export interface AnswerEvaluation {
  id: string;
  answerId: string;
  approvalScore: number; // 1–5
  complianceScore: number; // 1–5 (30% weight)
  completenessScore: number; // 1–5 (20% weight)
  competitivenessScore: number; // 1–5 (20% weight)
  clarityScore: number; // 1–5 (15% weight)
  evidenceScore: number; // 1–5 (15% weight)
  confidenceScore: number; // 0–1
  strengths: string[];
  weaknesses: string[];
  missingRequirements: string[];
  recommendations: string[];
  evaluationModelId: string;
  evaluatedAt: string;
}

// ─── Proposal ────────────────────────────────────────────────

export type ProposalStatus =
  | "draft"
  | "in_review"
  | "submitted"
  | "approved"
  | "rejected"
  | "archived";

export interface ProposalSection {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  isCustom: boolean;
  linkedAnswerId?: string;
}

export interface Proposal {
  id: string;
  rfpId: string;
  rfpDocument?: RFPDocument;
  title: string;
  status: ProposalStatus;
  sections: ProposalSection[];
  answers: GeneratedAnswer[];
  overallScore?: number;
  createdBy: string;
  assignedTo?: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  outcomeAt?: string;
  customerFeedback?: string;
  exportedFormats?: string[];
  // Edit tracking for learning
  totalAiGeneratedWords: number;
  totalHumanEditedWords: number;
  editRatio: number;
}

// ─── Audit Log ───────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: "rfp" | "proposal" | "answer" | "knowledge" | "user" | "system";
  resourceId: string;
  previousValue?: unknown;
  newValue?: unknown;
  timestamp: string;
  ipAddress?: string;
}

// ─── Chat ─────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  confidenceScore?: number;
  sources?: RetrievedSource[];
  relatedApprovedResponses?: KnowledgeRecord[];
  timestamp: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  rfpId?: string;
  proposalId?: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Wrappers ───────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

// ─── Upload ──────────────────────────────────────────────────

export interface UploadProgress {
  stage: "uploading" | "extracting" | "analyzing" | "complete" | "error";
  percentage: number;
  message: string;
  jobId?: string;
}

// ─── Analytics ───────────────────────────────────────────────

export interface ProposalAnalytics {
  totalProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
  pendingProposals: number;
  averageApprovalScore: number;
  winRate: number;
  averageEditRatio: number;
  topIndustries: { industry: string; count: number }[];
  scoreDistribution: { score: number; count: number }[];
  monthlyTrend: { month: string; submitted: number; approved: number }[];
}

// ─── Model Config ─────────────────────────────────────────────

export type BedrockModelId =
  | "anthropic.claude-3-5-sonnet-20241022-v2:0"
  | "anthropic.claude-3-opus-20240229-v1:0"
  | "amazon.nova-pro-v1:0"
  | "amazon.nova-lite-v1:0";

export interface ModelConfig {
  generationModelId: BedrockModelId;
  evaluationModelId: BedrockModelId;
  embeddingModelId: string;
  maxTokens: number;
  temperature: number;
  topP: number;
}

// ─── Prompt Template ─────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  type: "extraction" | "generation" | "evaluation" | "chat";
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}
