/**
 * Proposals Service — lifecycle and status management.
 */
import { get, post, patch } from "@/lib/api-client";
import type {
  ApiResponse,
  PaginatedResponse,
  Proposal,
  ProposalStatus,
  ProposalAnalytics,
  AuditLogEntry,
} from "@/types";

export interface ListProposalsParams {
  page?: number;
  pageSize?: number;
  status?: ProposalStatus;
  client?: string;
  industry?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function listProposals(
  params: ListProposalsParams = {}
): Promise<ApiResponse<PaginatedResponse<Proposal>>> {
  return get("/proposals", { params });
}

export async function getProposalById(id: string): Promise<ApiResponse<Proposal>> {
  return get(`/proposals/${id}`);
}

export async function updateProposalStatus(
  id: string,
  status: ProposalStatus,
  note?: string
): Promise<ApiResponse<Proposal>> {
  return patch(`/proposals/${id}/status`, { status, note });
}

export async function assignProposal(
  id: string,
  userIds: string[]
): Promise<ApiResponse<Proposal>> {
  return patch(`/proposals/${id}/assign`, { userIds });
}

export async function submitProposal(id: string): Promise<ApiResponse<Proposal>> {
  return post(`/proposals/${id}/submit`);
}

export async function archiveProposal(id: string): Promise<ApiResponse<void>> {
  return post(`/proposals/${id}/archive`);
}

// ─── Outcome recording (triggers knowledge ingestion) ─────────

export async function recordOutcome(
  id: string,
  outcome: "approved" | "rejected",
  payload: {
    feedback?: string;
    isStrategicCustomer?: boolean;
  }
): Promise<ApiResponse<{ knowledgeRecordsAdded: number }>> {
  return post(`/proposals/${id}/outcome`, { outcome, ...payload });
}

// ─── Audit trail ─────────────────────────────────────────────

export async function getProposalAuditLog(
  proposalId: string
): Promise<ApiResponse<AuditLogEntry[]>> {
  return get(`/proposals/${proposalId}/audit-log`);
}

// ─── Analytics ───────────────────────────────────────────────

export async function getProposalAnalytics(): Promise<ApiResponse<ProposalAnalytics>> {
  return get("/proposals/analytics");
}

// ─── Duplication ─────────────────────────────────────────────

export async function duplicateProposal(id: string): Promise<ApiResponse<Proposal>> {
  return post(`/proposals/${id}/duplicate`);
}
