// ─── Application constants ────────────────────────────────────

export const APP_NAME = "RFP Platform";
export const APP_DESCRIPTION = "Enterprise AI-Powered RFP Response Platform";

// ─── Performance SLAs ─────────────────────────────────────────
export const SLA_RESPONSE_GENERATION_MS = 15_000;
export const SLA_SEARCH_MS = 3_000;
export const SLA_UPLOAD_PROCESSING_MS = 30_000;

// ─── Upload limits ────────────────────────────────────────────
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
export const ACCEPTED_FILE_EXTENSIONS = [".pdf", ".docx", ".txt"];

// ─── Scoring weights ─────────────────────────────────────────
export const SCORE_WEIGHTS = {
  compliance: 0.3,
  completeness: 0.2,
  competitiveness: 0.2,
  clarity: 0.15,
  evidence: 0.15,
} as const;

// ─── Knowledge quality retrieval boost ───────────────────────
export const QUALITY_RETRIEVAL_BOOST: Record<number, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.5,
  4: 2.0,
  5: 2.5,
};

// ─── Pagination ───────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─── AWS resource names ───────────────────────────────────────
export const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1";
export const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET ?? "rfp-platform-documents";
export const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT ?? "";
export const OPENSEARCH_INDEX = "rfp-knowledge-base";

// ─── Bedrock models ───────────────────────────────────────────
export const BEDROCK_GENERATION_MODEL =
  process.env.BEDROCK_GENERATION_MODEL ?? "anthropic.claude-3-5-sonnet-20241022-v2:0";
export const BEDROCK_EVALUATION_MODEL =
  process.env.BEDROCK_EVALUATION_MODEL ?? "anthropic.claude-3-opus-20240229-v1:0";
export const BEDROCK_EMBEDDING_MODEL =
  process.env.BEDROCK_EMBEDDING_MODEL ?? "amazon.titan-embed-text-v2:0";

// ─── Proposal sections (default template) ────────────────────
export const DEFAULT_PROPOSAL_SECTIONS = [
  { id: "exec-summary", title: "Executive Summary", orderIndex: 0 },
  { id: "company-overview", title: "Company Overview", orderIndex: 1 },
  { id: "response-requirements", title: "Response To Requirements", orderIndex: 2 },
  { id: "technical-solution", title: "Technical Solution", orderIndex: 3 },
  { id: "support-model", title: "Support Model", orderIndex: 4 },
  { id: "implementation-plan", title: "Implementation Plan", orderIndex: 5 },
  { id: "pricing-response", title: "Pricing Response", orderIndex: 6 },
];

// ─── Navigation items ─────────────────────────────────────────
export const NAV_ITEMS = [
  { href: "/upload", label: "Upload RFP", icon: "Upload" },
  { href: "/analysis", label: "Analysis", icon: "BarChart2" },
  { href: "/chat", label: "AI Chat", icon: "MessageSquare" },
  { href: "/editor", label: "Editor", icon: "FileEdit" },
  { href: "/preview", label: "Preview", icon: "Eye" },
  { href: "/lifecycle", label: "Lifecycle", icon: "Activity" },
  { href: "/admin", label: "Admin", icon: "Settings" },
] as const;
