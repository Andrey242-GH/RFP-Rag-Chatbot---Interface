/**
 * POST /api/knowledge/retrieve
 *
 * Hybrid search (vector + keyword) against OpenSearch Serverless.
 * Results are boosted by KnowledgeQualityLevel (Level 5 = highest priority).
 *
 * Steps:
 *   1. Generate query embedding via Bedrock Titan Embed
 *   2. Run hybrid KNN + BM25 query against OpenSearch
 *   3. Apply quality boost multipliers
 *   4. Return ranked sources
 */
import { type NextRequest } from "next/server";
import { generateEmbedding } from "@/lib/bedrock";
import { hybridSearch, toRetrievedSources, computeRetrievalQualityScore } from "@/lib/opensearch";
import type { KnowledgeQualityLevel } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      question: string;
      industry?: string;
      region?: string;
      domain?: string;
      minQualityLevel?: number;
      topK?: number;
    };

    if (!body.question) {
      return Response.json({ success: false, message: "question is required" }, { status: 400 });
    }

    const topK = Math.min(body.topK ?? 5, 20);

    // 1. Generate query embedding
    const queryVector = await generateEmbedding(body.question);

    // 2. Hybrid search
    const hits = await hybridSearch({
      queryVector,
      queryText: body.question,
      topK,
      industry: body.industry,
      minQualityLevel: body.minQualityLevel as KnowledgeQualityLevel | undefined,
    });

    const sources = toRetrievedSources(hits);
    const retrievalQualityScore = computeRetrievalQualityScore(hits);
    const vectorScore =
      hits.length > 0 ? hits.reduce((s, h) => s + h.vectorScore, 0) / hits.length : 0;
    const keywordScore =
      hits.length > 0 ? hits.reduce((s, h) => s + h.keywordScore, 0) / hits.length : 0;

    return Response.json({
      success: true,
      data: {
        sources,
        retrievalQualityScore,
        hybridSearchUsed: true,
        vectorScore,
        keywordScore,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retrieval failed";
    console.error("retrieve error:", err);
    return Response.json({ success: false, message }, { status: 500 });
  }
}
