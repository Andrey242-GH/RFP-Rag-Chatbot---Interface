"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  RefreshCw,
  Loader2,
  FileEdit,
  ChevronRight,
  Plus,
  Trash2,
  Bot,
  History,
  Eye,
  GitCompare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getProposal, updateProposalSection } from "@/services/rag.service";
import {
  saveAnswerEdit,
  revertAnswerToAI,
  regenerateAnswer,
} from "@/services/rag.service";
import { cn, scoreToColor, scoreToBgColor, proposalStatusColor, proposalStatusLabel } from "@/lib/utils";
import type { GeneratedAnswer, ProposalSection, Proposal } from "@/types";

interface ProposalEditorProps {
  proposalId?: string;
}

export function ProposalEditor({ proposalId }: ProposalEditorProps) {
  const qc = useQueryClient();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => getProposal(proposalId!),
    enabled: !!proposalId,
  });

  const proposal: Proposal | undefined = data?.data;

  if (!proposalId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileEdit className="h-16 w-16 text-slate-300" />
        <h2 className="mt-4 text-xl font-semibold text-slate-700">No Proposal Selected</h2>
        <p className="mt-2 text-slate-500 max-w-sm">
          Generate a proposal first from the Analysis Dashboard.
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
        <span className="ml-3 text-slate-600">Loading proposal…</span>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        Proposal not found.
      </div>
    );
  }

  const currentAnswer = proposal.answers.find((a) => a.id === selectedAnswer);
  const currentSection = proposal.sections.find((s) => s.id === selectedSection);

  return (
    <div className="flex h-full gap-4 min-h-0">
      {/* Left: Section navigation */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold text-slate-900 truncate">{proposal.title}</h1>
          <Badge className={proposalStatusColor(proposal.status)}>
            {proposalStatusLabel(proposal.status)}
          </Badge>
        </div>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sections</p>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {proposal.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setSelectedSection(section.id);
                  setSelectedAnswer(null);
                }}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors flex items-center gap-2",
                  selectedSection === section.id
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    selectedSection === section.id && "rotate-90"
                  )}
                />
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </div>

          <Separator className="my-3" />

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">
            Q&A Responses ({proposal.answers.length})
          </p>
          <div className="space-y-1">
            {proposal.answers.map((answer, idx) => {
              const score = answer.evaluation?.approvalScore ?? 0;
              const isEdited = answer.activeVersion === "human";
              return (
                <button
                  key={answer.id}
                  onClick={() => {
                    setSelectedAnswer(answer.id);
                    setSelectedSection(null);
                  }}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                    selectedAnswer === answer.id
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-xs text-slate-400 mt-0.5">{idx + 1}.</span>
                    <span className="flex-1 line-clamp-2 text-xs">{answer.question}</span>
                    {score > 0 && (
                      <span className={cn("shrink-0 text-xs font-bold", scoreToColor(score))}>
                        {score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {isEdited && (
                    <Badge variant="info" className="mt-1 text-[10px]">
                      Edited
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Editor pane */}
      <div className="flex-1 min-w-0">
        {currentAnswer ? (
          <AnswerEditorPane
            answer={currentAnswer}
            proposalId={proposal.id}
            onSaved={() => qc.invalidateQueries({ queryKey: ["proposal", proposalId] })}
          />
        ) : currentSection ? (
          <SectionEditorPane
            section={currentSection}
            proposalId={proposal.id}
            onSaved={() => qc.invalidateQueries({ queryKey: ["proposal", proposalId] })}
          />
        ) : (
          <EditorPlaceholder />
        )}
      </div>
    </div>
  );
}

// ─── Answer Editor Pane ───────────────────────────────────────
function AnswerEditorPane({
  answer,
  proposalId,
  onSaved,
}: {
  answer: GeneratedAnswer;
  proposalId: string;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(
    answer.humanEditedContent ?? answer.aiGeneratedContent
  );
  const [changeNote, setChangeNote] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "compare" | "history">("edit");

  const saveMutation = useMutation({
    mutationFn: () => saveAnswerEdit(answer.id, { content, changeNote }),
    onSuccess: onSaved,
  });

  const revertMutation = useMutation({
    mutationFn: () => revertAnswerToAI(answer.id),
    onSuccess: () => {
      setContent(answer.aiGeneratedContent);
      onSaved();
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (instructions?: string) => regenerateAnswer(answer.id, instructions),
    onSuccess: (res) => {
      setContent(res.data.aiGeneratedContent);
      onSaved();
    },
  });

  const score = answer.evaluation?.approvalScore ?? 0;
  const isEdited = content !== answer.aiGeneratedContent;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 line-clamp-2">{answer.question}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={answer.activeVersion === "human" ? "info" : "secondary"} className="text-xs">
              {answer.activeVersion === "human" ? "Human Edited" : "AI Generated"}
            </Badge>
            {score > 0 && (
              <div className={cn("rounded px-2 py-0.5 text-xs font-bold border", scoreToBgColor(score))}>
                <span className={scoreToColor(score)}>{score.toFixed(1)}/5.0</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", regenerateMutation.isPending && "animate-spin")} />
            Regenerate
          </Button>
          {answer.activeVersion === "human" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revertMutation.mutate()}
              disabled={revertMutation.isPending}
            >
              <Bot className="mr-1.5 h-3.5 w-3.5" />
              Revert to AI
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isEdited}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="mr-1.5 h-3.5 w-3.5" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-1.5 h-3.5 w-3.5" />
            History ({answer.versionHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-3 flex-1">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm resize-y"
            aria-label="Answer content editor"
          />
          {isEdited && (
            <div className="mt-3">
              <label className="text-xs font-medium text-slate-600" htmlFor="change-note">
                Change note (optional)
              </label>
              <Textarea
                id="change-note"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe what you changed and why…"
                className="mt-1 min-h-[60px] text-sm resize-none"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="compare" className="mt-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                AI Original
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[300px]">
                {answer.aiGeneratedContent}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Human Edited
              </p>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[300px]">
                {answer.humanEditedContent ?? (
                  <span className="italic text-slate-400">No edits yet.</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-3">
          {answer.versionHistory.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No version history yet.
            </div>
          ) : (
            <div className="space-y-3">
              {answer.versionHistory.map((v) => (
                <Card key={v.versionNumber} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-700">
                        Version {v.versionNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        {v.editedBy} · {new Date(v.editedAt).toLocaleString()}
                      </span>
                    </div>
                    {v.changeNote && (
                      <p className="text-xs italic text-slate-500 mb-2">{v.changeNote}</p>
                    )}
                    <p className="text-sm text-slate-700 line-clamp-3">{v.content}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => setContent(v.content)}
                    >
                      Restore this version
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Section Editor Pane ──────────────────────────────────────
function SectionEditorPane({
  section,
  proposalId,
  onSaved,
}: {
  section: ProposalSection;
  proposalId: string;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(section.content);

  const saveMutation = useMutation({
    mutationFn: () => updateProposalSection(proposalId, section.id, content),
    onSuccess: onSaved,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || content === section.content}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          size="sm"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Save Section
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[500px] font-mono text-sm resize-y"
        aria-label={`${section.title} content editor`}
        placeholder="Start writing…"
      />
    </div>
  );
}

// ─── Placeholder ──────────────────────────────────────────────
function EditorPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <FileEdit className="h-16 w-16 text-slate-200" />
      <p className="mt-4 text-slate-500 text-sm">
        Select a section or Q&A response from the left panel to start editing.
      </p>
    </div>
  );
}
