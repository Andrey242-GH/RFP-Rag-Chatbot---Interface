"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Activity,
  Plus,
  Search,
  Filter,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  MoreHorizontal,
  FileText,
  Send,
  Archive,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import {
  listProposals,
  updateProposalStatus,
  submitProposal,
  archiveProposal,
  recordOutcome,
  getProposalAnalytics,
} from "@/services/proposals.service";
import {
  cn,
  proposalStatusColor,
  proposalStatusLabel,
  scoreToColor,
  formatDate,
  timeAgo,
} from "@/lib/utils";
import type { Proposal, ProposalStatus } from "@/types";

const STATUS_OPTIONS: { value: ProposalStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In Review" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

export function LifecycleDashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const [outcomeDialog, setOutcomeDialog] = useState<{
    proposalId: string;
    outcome: "approved" | "rejected";
  } | null>(null);
  const [feedback, setFeedback] = useState("");

  const { data: analyticsData } = useQuery({
    queryKey: ["proposal-analytics"],
    queryFn: getProposalAnalytics,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["proposals", statusFilter, search],
    queryFn: () =>
      listProposals({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search || undefined,
      }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitProposal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveProposal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });

  const outcomeMutation = useMutation({
    mutationFn: ({ proposalId, outcome, feedback }: { proposalId: string; outcome: "approved" | "rejected"; feedback?: string }) =>
      recordOutcome(proposalId, outcome, { feedback }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["proposal-analytics"] });
      setOutcomeDialog(null);
      setFeedback("");
    },
  });

  const analytics = analyticsData?.data;
  const proposals: Proposal[] = data?.data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proposal Lifecycle</h1>
          <p className="mt-1 text-slate-500">Track and manage all proposals through their lifecycle.</p>
        </div>
        <Button
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => router.push("/upload")}
        >
          <Plus className="mr-2 h-4 w-4" />
          New RFP
        </Button>
      </div>

      {/* Analytics cards */}
      {analytics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <AnalyticsCard
            label="Total"
            value={analytics.totalProposals}
            colorClass="text-slate-900"
          />
          <AnalyticsCard
            label="Approved"
            value={analytics.approvedProposals}
            colorClass="text-green-600"
            bgClass="bg-green-50"
          />
          <AnalyticsCard
            label="Rejected"
            value={analytics.rejectedProposals}
            colorClass="text-red-600"
            bgClass="bg-red-50"
          />
          <AnalyticsCard
            label="In Progress"
            value={analytics.pendingProposals}
            colorClass="text-indigo-600"
            bgClass="bg-indigo-50"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search proposals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search proposals"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ProposalStatus | "all")}
          >
            <SelectTrigger aria-label="Filter by status">
              <Filter className="mr-2 h-4 w-4 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Proposals table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <Activity className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            No proposals found. Upload an RFP to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-700">Proposal</th>
                <th className="px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Score</th>
                <th className="px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">Updated</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proposals.map((proposal) => (
                <ProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  onOpen={() => router.push(`/editor?proposalId=${proposal.id}`)}
                  onPreview={() => router.push(`/preview?proposalId=${proposal.id}`)}
                  onSubmit={() => submitMutation.mutate(proposal.id)}
                  onArchive={() => archiveMutation.mutate(proposal.id)}
                  onMarkOutcome={(outcome) =>
                    setOutcomeDialog({ proposalId: proposal.id, outcome })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outcome dialog */}
      <Dialog
        open={!!outcomeDialog}
        onOpenChange={(open) => {
          if (!open) {
            setOutcomeDialog(null);
            setFeedback("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark as {outcomeDialog?.outcome === "approved" ? "Approved ✅" : "Rejected ❌"}
            </DialogTitle>
            <DialogDescription>
              {outcomeDialog?.outcome === "approved"
                ? "This proposal will be added to the approved knowledge base and used for future RAG retrieval."
                : "The outcome and feedback will be stored for continuous learning."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="feedback">Customer Feedback (optional)</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Strong technical section, pricing was competitive…"
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutcomeDialog(null)}>
              Cancel
            </Button>
            <Button
              className={
                outcomeDialog?.outcome === "approved"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
              onClick={() => {
                if (outcomeDialog) {
                  outcomeMutation.mutate({
                    proposalId: outcomeDialog.proposalId,
                    outcome: outcomeDialog.outcome,
                    feedback: feedback || undefined,
                  });
                }
              }}
              disabled={outcomeMutation.isPending}
              loading={outcomeMutation.isPending}
            >
              {outcomeDialog?.outcome === "approved" ? "Confirm Approved" : "Confirm Rejected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Analytics Card ───────────────────────────────────────────
function AnalyticsCard({
  label,
  value,
  colorClass,
  bgClass = "bg-white",
}: {
  label: string;
  value: number;
  colorClass: string;
  bgClass?: string;
}) {
  return (
    <Card className={bgClass}>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={cn("text-3xl font-bold mt-1", colorClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Proposal Row ─────────────────────────────────────────────
function ProposalRow({
  proposal,
  onOpen,
  onPreview,
  onSubmit,
  onArchive,
  onMarkOutcome,
}: {
  proposal: Proposal;
  onOpen: () => void;
  onPreview: () => void;
  onSubmit: () => void;
  onArchive: () => void;
  onMarkOutcome: (outcome: "approved" | "rejected") => void;
}) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <button
          onClick={onOpen}
          className="text-left group"
          aria-label={`Open ${proposal.title}`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <p className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                {proposal.title}
              </p>
              {proposal.rfpDocument && (
                <p className="text-xs text-slate-400">
                  {proposal.rfpDocument.metadata.client} ·{" "}
                  {proposal.rfpDocument.metadata.industry}
                </p>
              )}
            </div>
          </div>
        </button>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <Badge className={proposalStatusColor(proposal.status)}>
          {proposalStatusLabel(proposal.status)}
        </Badge>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {proposal.overallScore !== undefined ? (
          <span className={cn("font-semibold text-sm", scoreToColor(proposal.overallScore))}>
            {proposal.overallScore.toFixed(1)}/5.0
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
        {timeAgo(proposal.updatedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Proposal actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <FileText className="mr-2 h-4 w-4" />
              Open Editor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPreview}>
              <ChevronRight className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            {proposal.status === "draft" || proposal.status === "in_review" ? (
              <DropdownMenuItem onClick={onSubmit}>
                <Send className="mr-2 h-4 w-4" />
                Submit to Customer
              </DropdownMenuItem>
            ) : null}
            {proposal.status === "submitted" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onMarkOutcome("approved")}
                  className="text-green-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Approved
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onMarkOutcome("rejected")}
                  className="text-red-700"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Mark as Rejected
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive} className="text-slate-500">
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
