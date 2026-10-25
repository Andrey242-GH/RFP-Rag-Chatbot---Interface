/**
 * RFP Service — upload, extraction, and document management.
 *
 * Architecture note: this service calls Next.js API routes which in turn
 * call the AWS backend (Textract for extraction, S3 for storage, DynamoDB
 * for metadata). The frontend never calls AWS directly.
 */
import { uploadFile, get, post, patch } from "@/lib/api-client";
import type {
  ApiResponse,
  PaginatedResponse,
  RFPDocument,
  RFPMetadata,
  ExtractedQuestion,
  UploadProgress,
} from "@/types";

// ─── Upload ───────────────────────────────────────────────────

export interface UploadRFPPayload {
  file: File;
  metadata: RFPMetadata;
  onProgress?: (progress: UploadProgress) => void;
}

export async function uploadRFP({
  file,
  metadata,
  onProgress,
}: UploadRFPPayload): Promise<ApiResponse<RFPDocument>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("metadata", JSON.stringify(metadata));

  return uploadFile<ApiResponse<RFPDocument>>("/rfp/upload", formData, (pct) => {
    onProgress?.({
      stage: pct < 100 ? "uploading" : "extracting",
      percentage: pct,
      message: pct < 100 ? `Uploading… ${pct}%` : "Processing document…",
    });
  });
}

// ─── Document listing ─────────────────────────────────────────

export interface ListRFPsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  industry?: string;
  client?: string;
  search?: string;
}

export async function listRFPs(
  params: ListRFPsParams = {}
): Promise<ApiResponse<PaginatedResponse<RFPDocument>>> {
  return get("/rfp", { params });
}

export async function getRFP(id: string): Promise<ApiResponse<RFPDocument>> {
  return get(`/rfp/${id}`);
}

export async function deleteRFP(id: string): Promise<ApiResponse<void>> {
  return post(`/rfp/${id}/archive`);
}

// ─── Extraction ───────────────────────────────────────────────

export async function getExtractedQuestions(
  rfpId: string
): Promise<ApiResponse<ExtractedQuestion[]>> {
  return get(`/rfp/${rfpId}/questions`);
}

export async function reprocessRFP(rfpId: string): Promise<ApiResponse<{ jobId: string }>> {
  return post(`/rfp/${rfpId}/reprocess`);
}

export async function getExtractionStatus(
  rfpId: string
): Promise<ApiResponse<{ status: string; progress: number; jobId: string }>> {
  return get(`/rfp/${rfpId}/extraction-status`);
}

// ─── Metadata updates ─────────────────────────────────────────

export async function updateRFPMetadata(
  rfpId: string,
  metadata: Partial<RFPMetadata>
): Promise<ApiResponse<RFPDocument>> {
  return patch(`/rfp/${rfpId}/metadata`, { metadata });
}

// ─── Pre-signed upload URL (direct-to-S3 pattern for large files) ─
export async function getPresignedUploadUrl(params: {
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<ApiResponse<{ uploadUrl: string; s3Key: string; rfpId: string }>> {
  return post("/rfp/presigned-url", params);
}
