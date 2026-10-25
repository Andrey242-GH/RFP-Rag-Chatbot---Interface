/**
 * OpenSearch Serverless client — server-only.
 *
 * Uses @opensearch-project/opensearch with AWS SigV4 request signing.
 * The collection endpoint is read from OPENSEARCH_ENDPOINT env var.
 *
 * Index: rfp-knowledge-base
 * Vector field: embedding (1024 dimensions, cosine similarity)
 *
 * Hybrid search: KNN (vector) + BM25 (keyword) with quality-level boost.
 */
import "server-only";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { QUALITY_RETRIEVAL_BOOST } from "@/lib/constants";
import type { KnowledgeQualityLevel, RetrievedSource } from "@/types";

export const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX ?? "rfp-knowledge-base";
const EMBEDDING_DIMENSIONS = 1024;

// ─── Client ───────────────────────────────────────────────────

function createClient(): Client {
  const endpoint = process.env.OPENSEARCH_ENDPOINT;
  if (!endpoint) {
    throw new Error("OPENSEARCH_ENDPOINT env var is required");
  }

  return new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION ?? "us-east-1",
      service: "aoss", // OpenSearch Serverless uses "aoss"
      getCredentials: defaultProvider(),
    }),
    node: endpoint,
  });
}

let _client: Client | null = null;
function getClient(): Client {
  if (!_client) _client = createClient();
  return _client;
}

// ─── Index management ─────────────────────────────────────────

export interface KnowledgeIndexDocument {
  id: string;
  question: string;
  answer: string;
  industry: string;
  customer: string;
  region: string;
  domain: string;
  proposalStatus: string;
  qualityLevel: KnowledgeQualityLevel;
  isStrategicCustomer: boolean;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

export async function ensureIndexExists(): Promise<void> {
  const client = getClient();
  const exists = await client.indices.exists({ index: OPENSEARCH_INDEX });
  if (exists.body) return;

  await client.indices.create({
    index: OPENSEARCH_INDEX,
    body: {
      settings: {
        index: {
          knn: true,
          "knn.algo_param.ef_search": 512,
        },
      },
      mappings: {
        properties: {
          id: { type: "keyword" },
          question: { type: "text", analyzer: "english" },
          answer: { type: "text", analyzer: "english" },
          industry: { type: "keyword" },
          customer: { type: "keyword" },
          region: { type: "keyword" },
          domain: { type: "keyword" },
          proposalStatus: { type: "keyword" },
          qualityLevel: { type: "integer" },
          isStrategicCustomer: { type: "boolean" },
          embedding: {
            type: "knn_vector",
            dimension: EMBEDDING_DIMENSIONS,
            method: {
              name: "hnsw",
              space_type: "cosinesimil",
              engine: "nmslib",
              parameters: { ef_construction: 128, m: 24 },
            },
          },
          createdAt: { type: "date" },
          updatedAt: { type: "date" },
        },
      },
    },
  });
}

// ─── Indexing ─────────────────────────────────────────────────

export async function indexDocument(doc: KnowledgeIndexDocument): Promise<void> {
  const client = getClient();
  await client.index({
    index: OPENSEARCH_INDEX,
    id: doc.id,
    body: doc,
    refresh: "wait_for",
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const client = getClient();
  await client.delete({ index: OPENSEARCH_INDEX, id, refresh: "wait_for" });
}

// ─── Hybrid search ────────────────────────────────────────────

export interface HybridSearchOptions {
  queryVector: number[];
  queryText: string;
  topK?: number;
  industry?: string;
  domain?: string;
  minQualityLevel?: KnowledgeQualityLevel;
}

export interface SearchHit {
  id: string;
  question: string;
  answer: string;
  industry: string;
  customer: string;
  region: string;
  domain: string;
  proposalStatus: string;
  qualityLevel: KnowledgeQualityLevel;
  vectorScore: number;
  keywordScore: number;
  boostedScore: number;
}

export async function hybridSearch(options: HybridSearchOptions): Promise<SearchHit[]> {
  const { queryVector, queryText, topK = 10, industry, domain, minQualityLevel } = options;
  const client = getClient();

  // Build optional filters
  const filters: unknown[] = [];
  if (industry) filters.push({ term: { industry } });
  if (domain) filters.push({ term: { domain } });
  if (minQualityLevel) {
    filters.push({ range: { qualityLevel: { gte: minQualityLevel } } });
  }

  // KNN query (vector similarity)
  const knnQuery = {
    knn: {
      embedding: {
        vector: queryVector,
        k: topK * 2, // retrieve more candidates and re-rank
      },
    },
  };

  // BM25 query (keyword match on question + answer)
  const bm25Query = {
    multi_match: {
      query: queryText,
      fields: ["question^2", "answer"],
      type: "best_fields",
    },
  };

  // Combined hybrid query
  const query =
    filters.length > 0
      ? {
          bool: {
            must: { hybrid: { queries: [knnQuery, bm25Query] } },
            filter: filters,
          },
        }
      : { hybrid: { queries: [knnQuery, bm25Query] } };

  const response = await client.search({
    index: OPENSEARCH_INDEX,
    body: {
      query,
      size: topK * 2,
      _source: {
        excludes: ["embedding"],
      },
    },
  });

  const hits = (response.body.hits?.hits ?? []) as Array<{
    _id: string;
    _score: number;
    _source: KnowledgeIndexDocument;
  }>;

  // Apply quality boost and re-rank
  const scored: SearchHit[] = hits.map((hit) => {
    const doc = hit._source;
    const boost = QUALITY_RETRIEVAL_BOOST[doc.qualityLevel] ?? 1.0;
    return {
      id: doc.id,
      question: doc.question,
      answer: doc.answer,
      industry: doc.industry,
      customer: doc.customer,
      region: doc.region,
      domain: doc.domain,
      proposalStatus: doc.proposalStatus,
      qualityLevel: doc.qualityLevel,
      vectorScore: hit._score,
      keywordScore: hit._score, // hybrid combines both; individual scores not separately available
      boostedScore: hit._score * boost,
    };
  });

  // Sort by boosted score and return top-K
  return scored
    .sort((a, b) => b.boostedScore - a.boostedScore)
    .slice(0, topK);
}

// ─── Convert search hits to RetrievedSource[] ─────────────────

export function toRetrievedSources(hits: SearchHit[]): RetrievedSource[] {
  if (hits.length === 0) return [];
  const maxScore = Math.max(...hits.map((h) => h.boostedScore));

  return hits.map((hit) => ({
    id: `src_${hit.id}`,
    knowledgeRecordId: hit.id,
    content: `Q: ${hit.question}\n\nA: ${hit.answer}`,
    relevanceScore: maxScore > 0 ? hit.boostedScore / maxScore : 0,
    qualityLevel: hit.qualityLevel,
    sourceType:
      hit.proposalStatus === "approved"
        ? "approved_proposal"
        : "enterprise_knowledge",
    metadata: {
      customer: hit.customer,
      industry: hit.industry,
      proposalStatus: hit.proposalStatus,
    },
  }));
}

// ─── Overall retrieval quality score ─────────────────────────

export function computeRetrievalQualityScore(hits: SearchHit[]): number {
  if (hits.length === 0) return 0;
  const avgBoostedScore =
    hits.reduce((s, h) => s + h.boostedScore, 0) / hits.length;
  const avgQuality =
    hits.reduce((s, h) => s + h.qualityLevel, 0) / hits.length;
  // Normalise to 0-1
  return Math.min(1, (avgBoostedScore * avgQuality) / (5 * 2.5));
}
