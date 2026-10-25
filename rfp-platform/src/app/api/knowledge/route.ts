/**
 * GET  /api/knowledge — list knowledge records
 * POST /api/knowledge — ingest a new record (embed + index + persist)
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { listKnowledge, createKnowledgeRecord, updateKnowledgeEmbeddingId } from "@/lib/dal/knowledge";
import { generateEmbedding } from "@/lib/bedrock";
import { indexDocument, ensureIndexExists } from "@/lib/opensearch";
import type { KnowledgeDomain, KnowledgeQualityLevel } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 20));
  const domain = searchParams.get("domain") as KnowledgeDomain | null;
  const qualityLevel = searchParams.get("qualityLevel")
    ? Number(searchParams.get("qualityLevel")) as KnowledgeQualityLevel
    : undefined;

  try {
    const result = await listKnowledge({ pageSize, domain: domain ?? undefined, qualityLevel });
    return Response.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page,
        pageSize,
        hasMore: result.items.length === pageSize,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list knowledge";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";
  const userRole = headersList.get("x-user-role");

  // Only admins and reviewers can directly add knowledge records
  if (userRole !== "admin" && userRole !== "reviewer") {
    return Response.json(
      { success: false, message: "Admin or Reviewer role required to add knowledge records" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json() as {
      question: string;
      answer: string;
      industry?: string;
      customer?: string;
      region?: string;
      domain?: KnowledgeDomain;
      proposalStatus?: string;
      qualityLevel?: number;
      isStrategicCustomer?: boolean;
      tags?: string[];
    };

    if (!body.question || !body.answer) {
      return Response.json(
        { success: false, message: "question and answer are required" },
        { status: 400 }
      );
    }

    // 1. Persist to DynamoDB first
    const record = await createKnowledgeRecord({
      question: body.question,
      answer: body.answer,
      industry: body.industry ?? "General",
      customer: body.customer ?? "Unknown",
      region: body.region ?? "Global",
      domain: (body.domain ?? "rfp") as KnowledgeDomain,
      proposalStatus: (body.proposalStatus ?? "ai_generated") as KnowledgeRecord["proposalStatus"],
      qualityLevel: (body.qualityLevel ?? 1) as KnowledgeQualityLevel,
      createdBy: userId,
      isStrategicCustomer: body.isStrategicCustomer ?? false,
      tags: body.tags,
    });

    // 2. Generate embedding via Bedrock Titan Embed
    const embeddingText = `${body.question}\n\n${body.answer}`;
    const embedding = await generateEmbedding(embeddingText);

    // 3. Ensure OpenSearch index exists
    await ensureIndexExists();

    // 4. Index in OpenSearch
    await indexDocument({
      id: record.id,
      question: record.question,
      answer: record.answer,
      industry: record.industry,
      customer: record.customer,
      region: record.region,
      domain: record.domain,
      proposalStatus: record.proposalStatus,
      qualityLevel: record.qualityLevel,
      isStrategicCustomer: record.isStrategicCustomer ?? false,
      embedding,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    // 5. Update embeddingId in DynamoDB
    await updateKnowledgeEmbeddingId(record.id, record.id);

    return Response.json({ success: true, data: record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Knowledge ingestion failed";
    console.error("knowledge POST error:", err);
    return Response.json({ success: false, message }, { status: 500 });
  }
}

// This import is needed for the proposalStatus type used in createKnowledgeRecord
import type { KnowledgeRecord } from "@/types";
