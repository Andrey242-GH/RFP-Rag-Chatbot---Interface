/**
 * Audit Log DAL — DynamoDB operations for the audit log table.
 *
 * Table key schema:
 *   PK: id          (partition key)
 *   GSI1: userId    (query by user)
 *   Sort: timestamp (for time-ordered listing via GSI or scan+sort)
 */
import "server-only";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLES } from "@/lib/dynamodb";
import type { AuditLogEntry } from "@/types";
import { v4 as uuidv4 } from "uuid";

export interface WriteAuditInput {
  userId: string;
  userName: string;
  action: string;
  resourceType: AuditLogEntry["resourceType"];
  resourceId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  const entry: AuditLogEntry = {
    id: `audit_${uuidv4()}`,
    userId: input.userId,
    userName: input.userName,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    previousValue: input.previousValue,
    newValue: input.newValue,
    ipAddress: input.ipAddress,
    timestamp: new Date().toISOString(),
  };

  await db.send(
    new PutCommand({
      TableName: TABLES.AUDIT_LOG,
      Item: entry,
    })
  );
}

export interface ListAuditOptions {
  page?: number;
  pageSize?: number;
  userId?: string;
  resourceType?: string;
  action?: string;
}

export async function listAuditLog(options: ListAuditOptions = {}): Promise<{
  items: AuditLogEntry[];
  total: number;
}> {
  const { pageSize = 50, userId, resourceType, action } = options;

  const result = await db.send(
    new ScanCommand({
      TableName: TABLES.AUDIT_LOG,
      Limit: 500,
    })
  );

  let items = (result.Items ?? []) as AuditLogEntry[];

  if (userId) items = items.filter((e) => e.userId === userId);
  if (resourceType) items = items.filter((e) => e.resourceType === resourceType);
  if (action) items = items.filter((e) => e.action.toLowerCase().includes(action.toLowerCase()));

  // Newest first
  items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return { items: items.slice(0, pageSize), total: items.length };
}
