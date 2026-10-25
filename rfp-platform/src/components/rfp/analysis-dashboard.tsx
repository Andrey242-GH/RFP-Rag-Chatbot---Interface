"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  FileQuestion,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getRFP, getExtractedQuestions } from "@/services/rfp.service";
import { generateAllAnswers, evaluateAllAnswers, getGenerationStatus } from "@/services/rag.service";
import {
  cn,
  scoreToColor,
  scoreToLabel,
  scoreToBgColor,
  confidenceToColor,
  confidenceToLabel,
  proposalStatusColor,
} from "@/lib/utils";
import type { ExtractedQuestion, GeneratedAnswer, AnswerEvaluation } from "@/types";

interface AnalysisDashboardProps {
  rfpId?: string;
}

export function AnalysisDashboard({ rfpId }: AnalysisDashboardProps) {
  const qc = useQueryClient();
  const [expandedAnswer, setExpandedAnswer] = useState<string | null>(null);

  // Load RFP document
  const { data: rfpData, isLoading: rfpLoading } = useQuery({
    queryKey: ["rfp", rfpId],
    queryFn: () => getRFP(rfpId!),
    enabled: !!rfpId,
  });

  // Load extracted questions
  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: ["rfp-questions", rfpId],
    queryFn: () => getExtractedQuestions(rfpId!),
    enabled: !!rfpId,
  });

  // Generate all answers
  const generateMutation = useMutation({
    mutationFn: () => generateAllAnswers(rfpId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfp-questions", rfpId] });
    },
  });

  const rfp = rfpData?.data;
  const questions: ExtractedQuestion[] = questionsData?.data ?? [];

  if (!rfpId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileQuestion className="h-16 w-16 text-slate-300" />
        <h2 className="mt-4 text-xl font-semibold text-slate-700">No RFP Selected</h2>
        <p className="mt-2 text-slate-500 max-w-sm">
          Upload an RFP document first, or select one from the Lifecycle dashboard.
        </p>
        <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white" asChild>
          <a href="/upload">Upload RFP</a>
        </Button>
      </div>
    );
  }

  if (rfpLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-slate-600">Loading analysis…</span>
      </div>
    );
  }

  const highPriority = questions.filter((q) => q.priority === "High").length;
  const mandatory = questions.filter((q) => q.requirementType === "mandatory").length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {rfp?.metadata.client ?? "RFP Analysis"}
          </h1>
          <p className="mt-1 text-slate-500">
            {rfp?.metadata.industry} · {rfp?.metadata.region} ·{" "}
            <span className={cn("font-medium", proposalStatusColor(rfp?.status as never ?? "draft"))}>
              {rfp?.status ?? "—"}
            </span>
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || questions.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {generateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          Generate All Answers
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Questions"
          value={questions.length}
          icon={<BarChart2 className="h-5 w-5 text-indigo-600" />}
          colorClass="bg-indigo-50"
        />
        <StatCard
          label="High Priority"
          value={highPriority}
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          colorClass="bg-orange-50"
        />
        <StatCard
          label="Mandatory"
          value={mandatory}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          colorClass="bg-green-50"
        />
        <StatCard
          label="Optional"
          value={questions.length - mandatory}
          icon={<Info className="h-5 w-5 text-blue-500" />}
          colorClass="bg-blue-50"
        />
      </div>

      {/* Questions & Responses */}
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Extracted Questions</TabsTrigger>
          <TabsTrigger value="responses">Generated Responses</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <QuestionList questions={questions} />
        </TabsContent>

        <TabsContent value="responses" className="mt-4">
          <ResponseList
            rfpId={rfpId}
            expandedAnswer={expandedAnswer}
            onToggle={(id) => setExpandedAnswer((prev) => (prev === id ? null : id))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colorClass)}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Question List ────────────────────────────────────────────
function QuestionList({ questions }: { questions: ExtractedQuestion[] }) {
  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          No questions extracted yet. The document may still be processing.
        </CardContent>
      </Card>
    );
  }

  const priorityColor: Record<string, string> = {
    High: "destructive",
    Medium: "warning",
    Low: "secondary",
  };

  return (
    <ScrollArea className="h-[600px] rounded-lg border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100">
        {questions.map((q, idx) => (
          <div key={q.id} className="p-4 hover:bg-slate-50">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{q.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={priorityColor[q.priority] as never}>{q.priority} Priority</Badge>
                  <Badge variant="outline" className="capitalize">
                    {q.requirementType.replace("_", " ")}
                  </Badge>
                  {q.section && (
                    <Badge variant="secondary" className="truncate max-w-[200px]">
                      {q.section}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ─── Response List ────────────────────────────────────────────
function ResponseList({
  rfpId,
  expandedAnswer,
  onToggle,
}: {
  rfpId: string;
  expandedAnswer: string | null;
  onToggle: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["rfp-answers", rfpId],
    queryFn: async () => {
      // Placeholder: in production this would come from the proposal answers endpoint
      return { data: [] as GeneratedAnswer[] };
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const answers: GeneratedAnswer[] = data?.data ?? [];

  if (answers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          No answers generated yet. Click <strong>Generate All Answers</strong> to start.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {answers.map((answer) => (
        <AnswerCard
          key={answer.id}
          answer={answer}
          isExpanded={expandedAnswer === answer.id}
          onToggle={() => onToggle(answer.id)}
        />
      ))}
    </div>
  );
}

// ─── Answer Card ──────────────────────────────────────────────
function AnswerCard({
  answer,
  isExpanded,
  onToggle,
}: {
  answer: GeneratedAnswer;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const eval_ = answer.evaluation;
  const score = eval_?.approvalScore ?? 0;
  const content = answer.humanEditedContent ?? answer.aiGeneratedContent;

  return (
    <Card className={cn("transition-shadow", isExpanded && "shadow-md")}>
      <CardHeader className="cursor-pointer pb-3" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 line-clamp-2">{answer.question}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {eval_ && (
              <div className={cn("rounded-lg border px-3 py-1 text-center", scoreToBgColor(score))}>
                <p className={cn("text-lg font-bold", scoreToColor(score))}>{score.toFixed(1)}</p>
                <p className="text-[10px] text-slate-500">/ 5.0</p>
              </div>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>

        {eval_ && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {(
              [
                ["Compliance", eval_.complianceScore, "30%"],
                ["Completeness", eval_.completenessScore, "20%"],
                ["Competitive", eval_.competitivenessScore, "20%"],
                ["Clarity", eval_.clarityScore, "15%"],
                ["Evidence", eval_.evidenceScore, "15%"],
              ] as [string, number, string][]
            ).map(([label, s]) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{label}</span>
                  <span>{s.toFixed(1)}</span>
                </div>
                <Progress value={(s / 5) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t border-slate-100 pt-4 space-y-4">
          {/* Answer content */}
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {content}
          </div>

          {/* Evaluation details */}
          {eval_ && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {eval_.strengths.length > 0 && (
                <EvalSection
                  title="Strengths"
                  items={eval_.strengths}
                  icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
                  itemColor="text-green-700"
                />
              )}
              {eval_.weaknesses.length > 0 && (
                <EvalSection
                  title="Weaknesses"
                  items={eval_.weaknesses}
                  icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                  itemColor="text-orange-700"
                />
              )}
              {eval_.missingRequirements.length > 0 && (
                <EvalSection
                  title="Missing Requirements"
                  items={eval_.missingRequirements}
                  icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                  itemColor="text-red-700"
                />
              )}
              {eval_.recommendations.length > 0 && (
                <EvalSection
                  title="Recommendations"
                  items={eval_.recommendations}
                  icon={<Info className="h-4 w-4 text-blue-500" />}
                  itemColor="text-blue-700"
                />
              )}
            </div>
          )}

          {/* Sources */}
          {answer.retrievalResult.sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Supporting Sources ({answer.retrievalResult.sources.length})
              </p>
              <div className="space-y-2">
                {answer.retrievalResult.sources.slice(0, 3).map((src) => (
                  <div
                    key={src.id}
                    className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-600"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="capitalize">
                        {src.sourceType.replace(/_/g, " ")}
                      </Badge>
                      <span className={cn("font-medium", confidenceToColor(src.relevanceScore))}>
                        {confidenceToLabel(src.relevanceScore)} relevance
                      </span>
                    </div>
                    <p className="line-clamp-2">{src.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function EvalSection({
  title,
  items,
  icon,
  itemColor,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  itemColor: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
        {icon}
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={cn("text-xs leading-relaxed", itemColor)}>
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
