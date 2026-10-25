/**
 * Admin Service — user management, analytics, and audit log.
 */
import { get, post, patch, del } from "@/lib/api-client";
import type { ApiResponse, AuditLogEntry, PaginatedResponse, User, UserRole } from "@/types";

// ─── User Management ──────────────────────────────────────────

export async function listUsers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole;
}): Promise<ApiResponse<PaginatedResponse<User>>> {
  return get("/admin/users", { params });
}

export interface AddUserPayload {
  email: string;
  role: UserRole;
  name?: string;
}

export async function addUser(payload: AddUserPayload): Promise<ApiResponse<User>> {
  return post("/admin/users", payload);
}

export async function updateUserRole(userId: string, role: UserRole): Promise<ApiResponse<User>> {
  return patch(`/admin/users/${userId}/role`, { role });
}

export async function deactivateUser(userId: string): Promise<ApiResponse<{ success: boolean }>> {
  return post(`/admin/users/${userId}/deactivate`);
}

// ─── Analytics ────────────────────────────────────────────────

export interface AdminAnalytics {
  totalProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
  approvalRate: number;
  averageScore: number;
  avgGenerationTimeMs: number;
  totalUsers: number;
  activeUsersThisWeek: number;
  totalKnowledgeRecords: number;
  proposalsByMonth: { month: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
}

export async function getAdminAnalytics(): Promise<ApiResponse<AdminAnalytics>> {
  return get("/admin/analytics");
}

// ─── Audit Log ────────────────────────────────────────────────

export async function getAuditLog(params?: {
  page?: number;
  pageSize?: number;
  userId?: string;
  resourceType?: string;
  action?: string;
  from?: string;
  to?: string;
}): Promise<ApiResponse<PaginatedResponse<AuditLogEntry>>> {
  return get("/admin/audit-log", { params });
}
