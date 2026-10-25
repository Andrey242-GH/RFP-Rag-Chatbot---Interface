/**
 * Amazon Bedrock client — server-only.
 *
 * Exposes:
 *   invokeModel()         — synchronous model invocation (generation, evaluation)
 *   invokeModelStream()   — streaming model invocation (chat)
 *   generateEmbedding()   — Titan Embed v2 vector generation
 */
import "server-only";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(process.env.AWS_ACCESS_KEY_ID
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
          sessionToken: process.env.AWS_SESSION_TOKEN,
        },
      }
    : {}),
});

export const GENERATION_MODEL =
  process.env.BEDROCK_GENERATION_MODEL ??
  "anthropic.claude-3-5-sonnet-20241022-v2:0";
export const EVALUATION_MODEL =
  process.env.BEDROCK_EVALUATION_MODEL ??
  "anthropic.claude-3-opus-20240229-v1:0";
export const EMBEDDING_MODEL =
  process.env.BEDROCK_EMBEDDING_MODEL ?? "amazon.titan-embed-text-v2:0";

// Set BEDROCK_MOCK=true in .env.local to skip real AWS calls during local dev
const IS_MOCK = process.env.BEDROCK_MOCK === "true";

// ─── Mock helpers ─────────────────────────────────────────────

function mockInvokeModel(options: ClaudeInvokeOptions): string {
  const lastMsg = options.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

  if (options.modelId === EVALUATION_MODEL || lastMsg.includes("evaluat") || lastMsg.includes("score")) {
    return JSON.stringify({
      score: 4,
      rationale: "[MOCK] Simulated evaluation — Bedrock not connected in local dev.",
      suggestions: ["Add specific metrics", "Include customer references"],
    });
  }
  if (lastMsg.includes("extract") || options.systemPrompt?.includes("question")) {
    return JSON.stringify([
      { question: "[MOCK] What is your company experience in this domain?", category: "Experience" },
      { question: "[MOCK] Describe your implementation timeline.", category: "Timeline" },
      { question: "[MOCK] What is the total cost of ownership?", category: "Pricing" },
    ]);
  }
  return `[MOCK — Bedrock not connected]\n\nThis is a simulated answer for local testing. Set BEDROCK_MOCK=false and add real AWS credentials to use ${GENERATION_MODEL}.`;
}

async function* mockStream(options: ClaudeInvokeOptions): AsyncGenerator<string> {
  const text = mockInvokeModel(options);
  for (const word of text.split(" ")) {
    yield word + " ";
    await new Promise((r) => setTimeout(r, 15));
  }
}

function mockEmbedding(text: string): number[] {
  const v = new Array<number>(1024).fill(0);
  for (let i = 0; i < text.length; i++) v[i % 1024] += text.charCodeAt(i) / 1000;
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / mag);
}

// ─── Types ────────────────────────────────────────────────────

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeInvokeOptions {
  modelId?: string;
  systemPrompt?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

// ─── Synchronous invocation ───────────────────────────────────

export async function invokeModel(options: ClaudeInvokeOptions): Promise<string> {
  if (IS_MOCK) return mockInvokeModel(options);

  const {
    modelId = GENERATION_MODEL,
    systemPrompt,
    messages,
    maxTokens = 4096,
    temperature = 0.3,
  } = options;

  const body: Record<string, unknown> = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body)) as {
    content: { type: string; text: string }[];
  };

  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
}

// ─── Streaming invocation ─────────────────────────────────────

export async function* invokeModelStream(
  options: ClaudeInvokeOptions
): AsyncGenerator<string> {
  if (IS_MOCK) { yield* mockStream(options); return; }

  const {
    modelId = GENERATION_MODEL,
    systemPrompt,
    messages,
    maxTokens = 4096,
    temperature = 0.3,
  } = options;

  const body: Record<string, unknown> = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const command = new InvokeModelWithResponseStreamCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  });

  const response = await bedrock.send(command);
  if (!response.body) return;

  for await (const event of response.body) {
    if (event.chunk?.bytes) {
      const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes)) as {
        type: string;
        delta?: { type: string; text: string };
      };
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        yield chunk.delta.text;
      }
    }
  }
}

// ─── Embedding generation ─────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  if (IS_MOCK) return mockEmbedding(text);

  // Titan Embed v2 max input is 8192 tokens; truncate long text
  const truncated = text.slice(0, 25000);

  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: truncated,
      dimensions: 1024,
      normalize: true,
    }),
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body)) as {
    embedding: number[];
  };
  return result.embedding;
}
