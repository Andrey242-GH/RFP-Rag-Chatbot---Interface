import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type KnowledgeQualityLevel, type ProposalStatus, type RFPStatus } from "@/types";

// ─── Tailwind class merging ──────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date formatting ─────────────────────────────────────────
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── File size formatting ─────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Score helpers ────────────────────────────────────────────
export function scoreToLabel(score: number): string {
  if (score >= 4.5) return "Highly Likely to Approve";
  if (score >= 3.5) return "Strong";
  if (score >= 2.5) return "Acceptable";
  if (score >= 1.5) return "Weak";
  return "Very Unlikely to Approve";
}

export function scoreToColor(score: number): string {
  if (score >= 4.5) return "text-emerald-600";
  if (score >= 3.5) return "text-green-600";
  if (score >= 2.5) return "text-yellow-600";
  if (score >= 1.5) return "text-orange-600";
  return "text-red-600";
}

export function scoreToBgColor(score: number): string {
  if (score >= 4.5) return "bg-emerald-50 border-emerald-200";
  if (score >= 3.5) return "bg-green-50 border-green-200";
  if (score >= 2.5) return "bg-yellow-50 border-yellow-200";
  if (score >= 1.5) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

export function confidenceToLabel(score: number): string {
  if (score >= 0.85) return "High";
  if (score >= 0.65) return "Medium";
  return "Low";
}

export function confidenceToColor(score: number): string {
  if (score >= 0.85) return "text-green-600";
  if (score >= 0.65) return "text-yellow-600";
  return "text-red-600";
}

// ─── Status labels & colors ───────────────────────────────────
export function proposalStatusLabel(status: ProposalStatus): string {
  const labels: Record<ProposalStatus, string> = {
    draft: "Draft",
    in_review: "In Review",
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    archived: "Archived",
  };
  return labels[status] ?? status;
}

export function proposalStatusColor(status: ProposalStatus): string {
  const colors: Record<ProposalStatus, string> = {
    draft: "bg-slate-100 text-slate-700",
    in_review: "bg-blue-100 text-blue-700",
    submitted: "bg-purple-100 text-purple-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    archived: "bg-gray-100 text-gray-600",
  };
  return colors[status] ?? "bg-slate-100 text-slate-700";
}

export function rfpStatusLabel(status: RFPStatus): string {
  const labels: Record<RFPStatus, string> = {
    uploading: "Uploading",
    processing: "Processing",
    extracted: "Extracted",
    generating: "Generating",
    draft: "Draft",
    in_review: "In Review",
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    archived: "Archived",
  };
  return labels[status] ?? status;
}

// ─── Knowledge quality ────────────────────────────────────────
export function qualityLevelLabel(level: KnowledgeQualityLevel): string {
  const labels: Record<KnowledgeQualityLevel, string> = {
    1: "AI Generated",
    2: "Human Reviewed",
    3: "Submitted",
    4: "Customer Approved",
    5: "Approved + Strategic",
  };
  return labels[level];
}

export function qualityLevelColor(level: KnowledgeQualityLevel): string {
  const colors: Record<KnowledgeQualityLevel, string> = {
    1: "bg-slate-100 text-slate-600",
    2: "bg-blue-100 text-blue-700",
    3: "bg-purple-100 text-purple-700",
    4: "bg-green-100 text-green-700",
    5: "bg-emerald-100 text-emerald-800",
  };
  return colors[level];
}

// ─── String utilities ─────────────────────────────────────────
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Weighted approval score calculator ──────────────────────
export function calculateWeightedScore(scores: {
  compliance: number;
  completeness: number;
  competitiveness: number;
  clarity: number;
  evidence: number;
}): number {
  return (
    scores.compliance * 0.3 +
    scores.completeness * 0.2 +
    scores.competitiveness * 0.2 +
    scores.clarity * 0.15 +
    scores.evidence * 0.15
  );
}

// ─── Edit ratio ───────────────────────────────────────────────
export function calculateEditRatio(aiWords: number, humanWords: number): number {
  if (aiWords === 0) return 0;
  return Math.abs(humanWords - aiWords) / aiWords;
}
