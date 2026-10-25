/**
 * Proposals DAL — DynamoDB operations for proposals and their sections.
 *
 * Table key schema:
 *   PK: id               (partition key)
 *   GSI1: createdBy      (list proposals by owner)
 *   GSI2: status         (filter by lifecycle status)
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
import type { Proposal, ProposalStatus, ProposalSection } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_PROPOSAL_SECTIONS } from "@/lib/constants";

// ─── Read ──────────────────────────────────────────────────────

export async function getProposalById(id: string): Promise<Proposal | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLES.PROPOSALS, Key: { id } })
  );
  return (result.Item as Proposal) ?? null;
}

export interface ListProposalsOptions {
  page?: number;
  pageSize?: number;
  status?: ProposalStatus;
  search?: string;
  createdBy?: string;
}

export async function listProposals(options: ListProposalsOptions = {}): Promise<{
  items: Proposal[];
  total: number;
}> {
  const { pageSize = 20, status, search, createdBy } = options;

  const result = await db.send(
    new ScanCommand({ TableName: TABLES.PROPOSALS, Limit: 200 })
  );

  let items = (result.Items ?? []) as Proposal[];

  if (status) items = items.filter((p) => p.status === status);
  if (createdBy) items = items.filter((p) => p.createdBy === createdBy);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter((p) => p.title.toLowerCase().includes(q));
  }

  // Sort newest first
  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { items: items.slice(0, pageSize), total: items.length };
}

// ─── Write ─────────────────────────────────────────────────────

export interface CreateProposalInput {
  rfpId: string;
  title: string;
  createdBy: string;
}

export async function createProposal(
  input: CreateProposalInput
): Promise<Proposal> {
  const now = new Date().toISOString();
  const proposal: Proposal = {
    id: `prop_${uuidv4()}`,
    rfpId: input.rfpId,
    title: input.title,
    status: "draft",
    sections: DEFAULT_PROPOSAL_SECTIONS.map((s) => ({
      ...s,
      content: "",
      isCustom: false,
    })),
    answers: [],
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    totalAiGeneratedWords: 0,
    totalHumanEditedWords: 0,
    editRatio: 0,
  };

  await db.send(
    new PutCommand({
      TableName: TABLES.PROPOSALS,
      Item: proposal,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return proposal;
}

export async function updateProposalStatus(
  id: string,
  status: ProposalStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const updates: string[] = ["#status = :status", "updatedAt = :now"];
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = {
    ":status": status,
    ":now": new Date().toISOString(),
    ...Object.fromEntries(
      Object.entries(extra).map(([k, v]) => [`:${k}`, v])
    ),
  };

  for (const [k] of Object.entries(extra)) {
    updates.push(`${k} = :${k}`);
  }

  await db.send(
    new UpdateCommand({
      TableName: TABLES.PROPOSALS,
      Key: { id },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(id)",
    })
  );
}

export async function updateProposalSection(
  proposalId: string,
  sectionId: string,
  content: string
): Promise<void> {
  // Fetch, mutate the section array, save back (DynamoDB list updates by index are fragile)
  const proposal = await getProposalById(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

  const sections: ProposalSection[] = proposal.sections.map((s) =>
    s.id === sectionId ? { ...s, content } : s
  );

  await db.send(
    new UpdateCommand({
      TableName: TABLES.PROPOSALS,
      Key: { id: proposalId },
      UpdateExpression: "SET sections = :sections, updatedAt = :now",
      ExpressionAttributeValues: {
        ":sections": sections,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
    })
  );
}

export async function deleteProposal(id: string): Promise<void> {
  await db.send(
    new DeleteCommand({ TableName: TABLES.PROPOSALS, Key: { id } })
  );
}

export async function recordProposalOutcome(
  proposalId: string,
  outcome: "approved" | "rejected",
  customerFeedback?: string
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.PROPOSALS,
      Key: { id: proposalId },
      UpdateExpression:
        "SET #status = :status, outcomeAt = :now, updatedAt = :now, customerFeedback = :fb",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": outcome,
        ":now": new Date().toISOString(),
        ":fb": customerFeedback ?? "",
      },
      ConditionExpression: "attribute_exists(id)",
    })
  );
}
