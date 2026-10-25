/**
 * POST /api/chat
 *
 * RAG-grounded conversational endpoint with streaming.
 *
 * Every response includes:
 *   - Confidence score (based on retrieval quality)
 *   - Source citations (from OpenSearch)
 *   - Hallucination guard: if retrieval quality < threshold, return
 *     "Insufficient supporting documentation found."
 *
 * Uses Server-Sent Events (SSE) for streaming via ReadableStream.
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { generateEmbedding, invokeModelStream, GENERATION_MODEL } from "@/lib/bedrock";
import { hybridSearch, toRetrievedSources, computeRetrievalQualityScore } from "@/lib/opensearch";
import { buildChatPrompt, CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { appendMessages, getSession as getChatSession } from "@/lib/dal/chat";
import type { ChatMessage } from "@/types";
import { v4 as uuidv4 } from "uuid";

const MIN_RETRIEVAL_QUALITY = 0.2; // Below this threshold → hallucination guard
const INSUFFICIENT_CONTEXT =
  "Insufficient supporting documentation found. Please refine your question or upload relevant documents.";

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "anonymous";
  const userEmail = headersList.get("x-user-email") ?? "";

  try {
    const body = await request.json() as {
      sessionId?: string;
      message: string;
      rfpId?: string;
      proposalId?: string;
      context?: { questionId?: string; industry?: string };
    };

    if (!body.message?.trim()) {
      return Response.json({ success: false, message: "message is required" }, { status: 400 });
    }

    const sessionId = body.sessionId ?? `sess_${uuidv4()}`;

    // Load conversation history
    const existingSession = await getChatSession(sessionId).catch(() => null);
    const conversationHistory = (existingSession?.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Generate embedding for the query
    const queryVector = await generateEmbedding(body.message);

    // Hybrid search
    const hits = await hybridSearch({
      queryVector,
      queryText: body.message,
      topK: 5,
      industry: body.context?.industry,
    });

    const sources = toRetrievedSources(hits);
    const retrievalQualityScore = computeRetrievalQualityScore(hits);
    const confidenceScore = Math.min(1, retrievalQualityScore * 1.5);

    // Hallucination guard
    if (retrievalQualityScore < MIN_RETRIEVAL_QUALITY) {
      const userMsg: ChatMessage = {
        id: `msg_${uuidv4()}`,
        sessionId,
        role: "user",
        content: body.message,
        timestamp: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        id: `msg_${uuidv4()}`,
        sessionId,
        role: "assistant",
        content: INSUFFICIENT_CONTEXT,
        confidenceScore: 0.1,
        sources: [],
        timestamp: new Date().toISOString(),
      };

      await appendMessages(sessionId, userId, [userMsg, assistantMsg], body.rfpId, body.proposalId).catch(() => {});

      return Response.json({
        success: true,
        data: {
          sessionId,
          messageId: assistantMsg.id,
          content: INSUFFICIENT_CONTEXT,
          confidenceScore: 0.1,
          sources: [],
          streaming: false,
        },
      });
    }

    // Build RAG prompt
    const contextText = sources
      .map(
        (s, i) =>
          `[Source ${i + 1} — Quality Level ${s.qualityLevel}]\n${s.content}`
      )
      .join("\n\n---\n\n");

    const { messages } = buildChatPrompt(body.message, contextText, conversationHistory);
    const assistantMsgId = `msg_${uuidv4()}`;

    // Stream response using Web Streams ReadableStream
    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        // First chunk: metadata
        const meta = JSON.stringify({
          type: "meta",
          sessionId,
          messageId: assistantMsgId,
          confidenceScore,
          sources: sources.slice(0, 3), // Send top 3 sources
        });
        controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

        // Stream generated text
        try {
          for await (const chunk of invokeModelStream({
            modelId: GENERATION_MODEL,
            systemPrompt: CHAT_SYSTEM_PROMPT,
            messages,
            maxTokens: 2048,
            temperature: 0.4,
          })) {
            fullContent += chunk;
            const textEvent = JSON.stringify({ type: "text", content: chunk });
            controller.enqueue(encoder.encode(`data: ${textEvent}\n\n`));
          }

          // Persist conversation
          const userMsg: ChatMessage = {
            id: `msg_${uuidv4()}`,
            sessionId,
            role: "user",
            content: body.message,
            timestamp: new Date().toISOString(),
          };
          const assistantMsg: ChatMessage = {
            id: assistantMsgId,
            sessionId,
            role: "assistant",
            content: fullContent,
            confidenceScore,
            sources,
            timestamp: new Date().toISOString(),
          };

          await appendMessages(sessionId, userId, [userMsg, assistantMsg], body.rfpId, body.proposalId).catch(
            (e) => console.error("Failed to persist chat messages:", e)
          );

          // Done event
          const done = JSON.stringify({ type: "done", messageId: assistantMsgId });
          controller.enqueue(encoder.encode(`data: ${done}\n\n`));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Generation failed";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`));
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat request failed";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
