/**
 * RFP Documents DAL — DynamoDB operations for RFP documents.
 *
 * Table key schema:
 *   PK: id              (partition key)
 *   GSI1: uploadedBy    (list RFPs by owner)
 *   GSI2: status        (filter by processing status)
 */
import "server-only";

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { db, TABLES } from "@/lib/dynamodb";
import type { RFPDocument, RFPMetadata, RFPStatus } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ─── Read ──────────────────────────────────────────────────────

export async function getRFPById(id: string): Promise<RFPDocument | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLES.RFP, Key: { id } })
  );
  return (result.Item as RFPDocument) ?? null;
}

export interface ListRFPsOptions {
  pageSize?: number;
  status?: RFPStatus;
  uploadedBy?: string;
}

export async function listRFPs(options: ListRFPsOptions = {}): Promise<{
  items: RFPDocument[];
  total: number;
}> {
  const { pageSize = 20, status, uploadedBy } = options;

  const result = await db.send(
    new ScanCommand({ TableName: TABLES.RFP, Limit: 200 })
  );

  let items = (result.Items ?? []) as RFPDocument[];

  if (status) items = items.filter((r) => r.status === status);
  if (uploadedBy) items = items.filter((r) => r.uploadedBy === uploadedBy);

  items.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return { items: items.slice(0, pageSize), total: items.length };
}

// ─── Write ─────────────────────────────────────────────────────

export interface CreateRFPInput {
  fileName: string;
  fileSize: number;
  fileType: "pdf" | "docx" | "txt";
  s3Key: string;
  metadata: RFPMetadata;
  uploadedBy: string;
  pageCount?: number;
}

export async function createRFP(input: CreateRFPInput): Promise<RFPDocument> {
  const now = new Date().toISOString();
  const rfp: RFPDocument = {
    id: `rfp_${uuidv4()}`,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileType: input.fileType,
    s3Key: input.s3Key,
    metadata: input.metadata,
    status: "uploading",
    uploadedBy: input.uploadedBy,
    uploadedAt: now,
    pageCount: input.pageCount,
  };

  await db.send(
    new PutCommand({
      TableName: TABLES.RFP,
      Item: rfp,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return rfp;
}

export async function updateRFPStatus(
  id: string,
  status: RFPStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const updates: string[] = ["#status = :status", "updatedAt = :now"];
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = {
    ":status": status,
    ":now": new Date().toISOString(),
  };

  for (const [k, v] of Object.entries(extra)) {
    updates.push(`${k} = :${k}`);
    values[`:${k}`] = v;
  }

  await db.send(
    new UpdateCommand({
      TableName: TABLES.RFP,
      Key: { id },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(id)",
    })
  );
}
