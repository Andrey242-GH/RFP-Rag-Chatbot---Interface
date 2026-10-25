/**
 * Knowledge Base Service
 *
 * Manages the retrieval-weighted knowledge corpus:
 *   - CRUD for knowledge records
 *   - Ingestion pipeline triggers
 *   - Quality level management
 *   - Analytics
 */
import { get, post, put, patch, del } from "@/lib/api-client";
import type {
  ApiResponse,
  PaginatedResponse,
  KnowledgeRecord,
  KnowledgeQualityLevel,
  KnowledgeDomain,
} from "@/types";

// ─── Listing ──────────────────────────────────────────────────

export interface ListKnowledgeParams {
  page?: number;
  pageSize?: number;
  domain?: KnowledgeDomain;
  industry?: string;
  qualityLevel?: KnowledgeQualityLevel;
  proposalStatus?: string;
  search?: string;
}

export async function listKnowledgeRecords(
  params: ListKnowledgeParams = {}
): Promise<ApiResponse<PaginatedResponse<KnowledgeRecord>>> {
  return get("/knowledge", { params });
}

export async function getKnowledgeRecord(id: string): Promise<ApiResponse<KnowledgeRecord>> {
  return get(`/knowledge/${id}`);
}

// ─── Ingestion ────────────────────────────────────────────────

export interface IngestDocumentPayload {
  title: string;
  content: string;
  domain: KnowledgeDomain;
  industry: string;
  customer?: string;
  region?: string;
  qualityLevel?: KnowledgeQualityLevel;
  tags?: string[];
}

export async function ingestDocument(
  payload: IngestDocumentPayload
): Promise<ApiResponse<{ recordId: string; embeddingJobId: string }>> {
  return post("/knowledge/ingest", payload);
}

export async function ingestFromS3(params: {
  s3Key: string;
  domain: KnowledgeDomain;
  industry: string;
  customer?: string;
}): Promise<ApiResponse<{ jobId: string }>> {
  return post("/knowledge/ingest-s3", params);
}

// ─── Editing ─────────────────────────────────────────────────

export async function updateKnowledgeRecord(
  id: string,
  updates: Partial<KnowledgeRecord>
): Promise<ApiResponse<KnowledgeRecord>> {
  return put(`/knowledge/${id}`, updates);
}

export async function updateQualityLevel(
  id: string,
  level: KnowledgeQualityLevel
): Promise<ApiResponse<KnowledgeRecord>> {
  return patch(`/knowledge/${id}/quality-level`, { level });
}

export async function deleteKnowledgeRecord(id: string): Promise<ApiResponse<void>> {
  return del(`/knowledge/${id}`);
}

// ─── Re-embedding ─────────────────────────────────────────────

export async function reEmbedRecord(id: string): Promise<ApiResponse<{ jobId: string }>> {
  return post(`/knowledge/${id}/re-embed`);
}

export async function reEmbedAll(): Promise<ApiResponse<{ jobId: string; totalRecords: number }>> {
  return post("/knowledge/re-embed-all");
}

// ─── Analytics ───────────────────────────────────────────────

export interface KnowledgeStats {
  totalRecords: number;
  embeddingsGenerated: number;
  pendingEmbedding: number;
  byQualityLevel: Record<KnowledgeQualityLevel, number>;
  byDomain: Record<KnowledgeDomain, number>;
  byIndustry: { industry: string; count: number }[];
  lastUpdated?: string;
}

export async function getKnowledgeStats(): Promise<ApiResponse<KnowledgeStats>> {
  return get("/knowledge/stats");
}

// ─── Approved proposal ingestion (feedback loop) ──────────────

export interface ApprovedProposalIngestionPayload {
  proposalId: string;
  isStrategicCustomer?: boolean;
}

export async function ingestApprovedProposal(
  payload: ApprovedProposalIngestionPayload
): Promise<ApiResponse<{ recordsAdded: number; embeddingJobId: string }>> {
  return post("/knowledge/ingest-approved-proposal", payload);
}
