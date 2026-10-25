"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Loader2, Bot, User, ExternalLink, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { sendChatMessage, type ChatPayload, type ChatResponse } from "@/services/rag.service";
import { cn, confidenceToColor, confidenceToLabel, scoreToColor, scoreToLabel, generateId } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface ChatInterfaceProps {
  rfpId?: string;
  proposalId?: string;
}

const SUGGESTION_PROMPTS = [
  "Generate a stronger answer for question 1.",
  "Show me similar approved responses.",
  "What requirements am I missing?",
  "Rewrite this answer for Healthcare.",
];

export function ChatInterface({ rfpId, proposalId }: ChatInterfaceProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMutation = useMutation({
    mutationFn: (payload: ChatPayload) => sendChatMessage(payload),
    onSuccess: (response) => {
      const data = response.data as ChatResponse;
      setSessionId(data.sessionId);

      const assistantMessage: ChatMessage = {
        id: data.messageId,
        sessionId: data.sessionId,
        role: "assistant",
        content: data.content,
        confidenceScore: data.confidenceScore,
        sources: data.sources,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to get a response. Try again.";
      const errorMessage: ChatMessage = {
        id: generateId(),
        sessionId: sessionId ?? "local",
        role: "assistant",
        content: `⚠️ ${msg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      sessionId: sessionId ?? "local",
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    sendMutation.mutate({
      sessionId,
      message: text,
      rfpId,
      proposalId,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      {/* Message area */}
      <div className="flex-1 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <EmptyState onPromptClick={(p) => setInput(p)} />
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {sendMutation.isPending && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-none bg-slate-100 px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    <span className="text-sm text-slate-500">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input area */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your RFP, proposals, or knowledge base… (Enter to send, Shift+Enter for new line)"
          className="min-h-[80px] resize-none border-0 shadow-none focus-visible:ring-0 text-sm"
          aria-label="Chat message input"
          disabled={sendMutation.isPending}
        />
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {rfpId && <span>RFP context active</span>}
            {proposalId && <span className="ml-2">Proposal context active</span>}
          </p>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            size="sm"
          >
            <Send className="h-4 w-4 mr-1.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────
function EmptyState({ onPromptClick }: { onPromptClick: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
        <Bot className="h-8 w-8 text-indigo-600" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-800">RFP Knowledge Assistant</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Ask me to generate answers, find similar approved responses, identify missing requirements,
        or rewrite content for a specific industry.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-lg">
        {SUGGESTION_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPromptClick(p)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-slate-200" : "bg-indigo-600"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-slate-600" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      <div className={cn("flex-1 max-w-2xl", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "rounded-tr-none bg-indigo-600 text-white"
              : "rounded-tl-none bg-slate-100 text-slate-800"
          )}
        >
          {message.content}
        </div>

        {/* Confidence & score — only for assistant messages */}
        {!isUser && (message.confidenceScore !== undefined) && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className={cn("text-xs", confidenceToColor(message.confidenceScore ?? 0))}>
              Confidence: {confidenceToLabel(message.confidenceScore ?? 0)} (
              {((message.confidenceScore ?? 0) * 100).toFixed(0)}%)
            </Badge>
            {message.sources && message.sources.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {message.sources.length} source{message.sources.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-2 w-full">
            <Separator />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Supporting Sources
            </p>
            {message.sources.slice(0, 3).map((src) => (
              <Card key={src.id} className="border-slate-200">
                <CardContent className="p-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="secondary" className="capitalize">
                      {src.sourceType.replace(/_/g, " ")}
                    </Badge>
                    <span className={cn("font-medium", confidenceToColor(src.relevanceScore))}>
                      {(src.relevanceScore * 100).toFixed(0)}% relevance
                    </span>
                  </div>
                  <p className="line-clamp-2">{src.content}</p>
                  {src.metadata.customer && (
                    <p className="mt-1 text-slate-400">
                      {src.metadata.customer} · {src.metadata.industry}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
