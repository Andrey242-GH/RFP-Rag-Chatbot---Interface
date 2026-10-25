/**
 * Knowledge Base DAL — DynamoDB operations for knowledge records.
 *
 * Table key schema:
 *   PK: id             (partition key)
 *   GSI1: domain       (filter by domain)
 *   GSI2: qualityLevel (filter/sort by quality)
 */
import "server-only";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { db, TABLES } from "@/lib/dynamodb";
import type { KnowledgeRecord, KnowledgeQualityLevel, KnowledgeDomain } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ─── Read ──────────────────────────────────────────────────────

export async function getKnowledgeById(id: string): Promise<KnowledgeRecord | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLES.KNOWLEDGE, Key: { id } })
  );
  return (result.Item as KnowledgeRecord) ?? null;
}

export interface ListKnowledgeOptions {
  pageSize?: number;
  domain?: KnowledgeDomain;
  qualityLevel?: KnowledgeQualityLevel;
  industry?: string;
}

export async function listKnowledge(options: ListKnowledgeOptions = {}): Promise<{
  items: KnowledgeRecord[];
  total: number;
}> {
  const { pageSize = 50, domain, qualityLevel, industry } = options;

  const result = await db.send(
    new ScanCommand({ TableName: TABLES.KNOWLEDGE, Limit: 500 })
  );

  let items = (result.Items ?? []) as KnowledgeRecord[];

  if (domain) items = items.filter((k) => k.domain === domain);
  if (qualityLevel) items = items.filter((k) => k.qualityLevel === qualityLevel);
  if (industry) items = items.filter((k) => k.industry.toLowerCase() === industry.toLowerCase());

  items.sort((a, b) => b.qualityLevel - a.qualityLevel);

  return { items: items.slice(0, pageSize), total: items.length };
}

export async function getKnowledgeStats(): Promise<{
  totalRecords: number;
  embeddingsGenerated: number;
  pendingEmbedding: number;
  byQualityLevel: Record<number, number>;
  byDomain: Record<string, number>;
}> {
  const result = await db.send(
    new ScanCommand({ TableName: TABLES.KNOWLEDGE })
  );

  const items = (result.Items ?? []) as KnowledgeRecord[];
  const byQualityLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const byDomain: Record<string, number> = {};

  let embeddingsGenerated = 0;

  for (const item of items) {
    byQualityLevel[item.qualityLevel] = (byQualityLevel[item.qualityLevel] ?? 0) + 1;
    byDomain[item.domain] = (byDomain[item.domain] ?? 0) + 1;
    if (item.embeddingId) embeddingsGenerated++;
  }

  return {
    totalRecords: items.length,
    embeddingsGenerated,
    pendingEmbedding: items.length - embeddingsGenerated,
    byQualityLevel,
    byDomain,
  };
}

// ─── Write ─────────────────────────────────────────────────────

export interface CreateKnowledgeInput {
  question: string;
  answer: string;
  industry: string;
  customer: string;
  region: string;
  domain: KnowledgeDomain;
  proposalStatus: KnowledgeRecord["proposalStatus"];
  qualityLevel: KnowledgeQualityLevel;
  createdBy: string;
  approvalDate?: string;
  isStrategicCustomer?: boolean;
  embeddingId?: string;
  tags?: string[];
}

export async function createKnowledgeRecord(
  input: CreateKnowledgeInput
): Promise<KnowledgeRecord> {
  const now = new Date().toISOString();
  const record: KnowledgeRecord = {
    id: `kb_${uuidv4()}`,
    question: input.question,
    answer: input.answer,
    industry: input.industry,
    customer: input.customer,
    region: input.region,
    domain: input.domain,
    proposalStatus: input.proposalStatus,
    qualityLevel: input.qualityLevel,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    approvalDate: input.approvalDate,
    isStrategicCustomer: input.isStrategicCustomer ?? false,
    embeddingId: input.embeddingId,
    tags: input.tags,
  };

  await db.send(
    new PutCommand({
      TableName: TABLES.KNOWLEDGE,
      Item: record,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return record;
}

export async function updateKnowledgeEmbeddingId(
  id: string,
  embeddingId: string
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.KNOWLEDGE,
      Key: { id },
      UpdateExpression: "SET embeddingId = :eid, updatedAt = :now",
      ExpressionAttributeValues: {
        ":eid": embeddingId,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
    })
  );
}

export async function deleteKnowledgeRecord(id: string): Promise<void> {
  await db.send(
    new DeleteCommand({ TableName: TABLES.KNOWLEDGE, Key: { id } })
  );
}
