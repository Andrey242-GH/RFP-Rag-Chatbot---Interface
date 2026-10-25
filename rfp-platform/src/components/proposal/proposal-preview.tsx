"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { Download, FileText, Loader2, Eye, Printer, FileJson } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getProposal, exportProposal, type ExportFormat } from "@/services/rag.service";
import { cn, proposalStatusColor, proposalStatusLabel, scoreToColor, formatDate } from "@/lib/utils";
import type { Proposal } from "@/types";

interface ProposalPreviewProps {
  proposalId?: string;
}

export function ProposalPreview({ proposalId }: ProposalPreviewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => getProposal(proposalId!),
    enabled: !!proposalId,
  });

  const exportMutation = useMutation({
    mutationFn: (format: ExportFormat) => exportProposal(proposalId!, format),
    onSuccess: (res) => {
      window.open(res.data.downloadUrl, "_blank");
    },
  });

  if (!proposalId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Eye className="h-16 w-16 text-slate-300" />
        <h2 className="mt-4 text-xl font-semibold text-slate-700">No Proposal Selected</h2>
        <p className="mt-2 text-slate-500 max-w-sm">
          Select a proposal from the Lifecycle dashboard to preview it here.
        </p>
        <Button asChild className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white">
          <a href="/lifecycle">View Proposals</a>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-slate-600">Loading preview…</span>
      </div>
    );
  }

  const proposal: Proposal | undefined = data?.data;
  if (!proposal) {
    return (
      <div className="text-center py-24 text-slate-500">Proposal not found.</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{proposal.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
            <span>Created {formatDate(proposal.createdAt)}</span>
            <span>·</span>
            <Badge className={proposalStatusColor(proposal.status)}>
              {proposalStatusLabel(proposal.status)}
            </Badge>
            {proposal.overallScore !== undefined && (
              <>
                <span>·</span>
                <span className={cn("font-semibold", scoreToColor(proposal.overallScore))}>
                  Overall Score: {proposal.overallScore.toFixed(1)}/5.0
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            aria-label="Print proposal"
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                size="sm"
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportMutation.mutate("pdf")}>
                <FileText className="mr-2 h-4 w-4 text-red-500" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMutation.mutate("docx")}>
                <FileText className="mr-2 h-4 w-4 text-blue-500" />
                Export as DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMutation.mutate("txt")}>
                <FileJson className="mr-2 h-4 w-4 text-slate-500" />
                Export as TXT
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Document preview */}
      <ScrollArea className="h-[calc(100vh-220px)] rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-12 py-16 print:p-0">
          {/* Cover / Title block */}
          <div className="text-center mb-12 border-b border-slate-200 pb-10">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 mb-6">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{proposal.title}</h1>
            {proposal.rfpDocument && (
              <div className="mt-3 text-slate-500 space-y-1">
                <p className="text-lg">
                  Prepared for <strong>{proposal.rfpDocument.metadata.client}</strong>
                </p>
                <p>
                  {proposal.rfpDocument.metadata.industry} ·{" "}
                  {proposal.rfpDocument.metadata.region}
                </p>
                <p>
                  Submission date:{" "}
                  {formatDate(proposal.rfpDocument.metadata.submissionDate)}
                </p>
              </div>
            )}
            <div className="mt-4 flex justify-center gap-3">
              <Badge className={proposalStatusColor(proposal.status)}>
                {proposalStatusLabel(proposal.status)}
              </Badge>
              {proposal.overallScore !== undefined && (
                <Badge variant="outline">
                  Quality score: {proposal.overallScore.toFixed(1)}/5.0
                </Badge>
              )}
            </div>
          </div>

          {/* Proposal sections */}
          {proposal.sections.map((section, idx) => (
            <div key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-indigo-600 text-sm font-normal">{String(idx + 1).padStart(2, "0")}</span>
                {section.title}
              </h2>
              {section.content ? (
                <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
              ) : (
                <p className="italic text-slate-400">No content yet. Edit this section in the Editor.</p>
              )}
              {idx < proposal.sections.length - 1 && <Separator className="mt-8" />}
            </div>
          ))}

          {/* Q&A Responses */}
          {proposal.answers.length > 0 && (
            <>
              <Separator className="my-8" />
              <h2 className="text-xl font-bold text-slate-900 mb-6">Responses to Requirements</h2>
              <div className="space-y-8">
                {proposal.answers.map((answer, idx) => {
                  const content = answer.humanEditedContent ?? answer.aiGeneratedContent;
                  const score = answer.evaluation?.approvalScore;
                  return (
                    <div key={answer.id}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-semibold text-slate-800">
                          <span className="text-slate-400 font-normal">{idx + 1}. </span>
                          {answer.question}
                        </h3>
                        {score !== undefined && (
                          <span
                            className={cn(
                              "shrink-0 text-sm font-bold px-2 py-0.5 rounded",
                              scoreToColor(score),
                              "bg-slate-50"
                            )}
                          >
                            {score.toFixed(1)}/5
                          </span>
                        )}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4 text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                        {content}
                      </div>
                      {answer.retrievalResult.sources.length > 0 && (
                        <p className="mt-2 text-xs text-slate-400">
                          Supported by {answer.retrievalResult.sources.length} source
                          {answer.retrievalResult.sources.length !== 1 ? "s" : ""}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-16 border-t border-slate-200 pt-8 text-center text-xs text-slate-400">
            <p>Generated by RFP Platform · Confidential</p>
            <p className="mt-1">
              AI-generated content. Human review completed:{" "}
              {proposal.editRatio > 0 ? `${(proposal.editRatio * 100).toFixed(0)}% edited` : "No edits"}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
