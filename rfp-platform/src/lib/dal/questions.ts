/**
 * Questions DAL — DynamoDB operations for extracted RFP questions.
 *
 * Table key schema:
 *   PK: id          (partition key)
 *   GSI1: rfpId     (query all questions for an RFP, sorted by orderIndex)
 */
import "server-only";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { db, TABLES } from "@/lib/dynamodb";
import type { ExtractedQuestion, QuestionPriority } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Use the RFP table's questions attribute, or a separate table keyed by rfpId+questionId
// For simplicity we store extracted questions as sub-items in the RFP table under a
// separate "questions" partition. We use the answers table pattern but for questions.
// Table name reuses TABLES.RFP with a different PK prefix to avoid a new table for demo.
// In production, add a dedicated QUESTIONS table.
const QUESTIONS_TABLE = process.env.DYNAMODB_QUESTIONS_TABLE ?? "rfp-platform-questions";

export async function getQuestionById(id: string): Promise<ExtractedQuestion | null> {
  try {
    const result = await db.send(
      new GetCommand({ TableName: QUESTIONS_TABLE, Key: { id } })
    );
    return (result.Item as ExtractedQuestion) ?? null;
  } catch {
    return null;
  }
}

export async function listQuestionsByRfpId(rfpId: string): Promise<ExtractedQuestion[]> {
  try {
    const result = await db.send(
      new QueryCommand({
        TableName: QUESTIONS_TABLE,
        IndexName: "rfpId-index",
        KeyConditionExpression: "rfpId = :rfpId",
        ExpressionAttributeValues: { ":rfpId": rfpId },
      })
    );
    const items = (result.Items ?? []) as ExtractedQuestion[];
    return items.sort((a, b) => a.orderIndex - b.orderIndex);
  } catch {
    // Fallback scan if GSI doesn't exist yet
    const result = await db.send(new ScanCommand({ TableName: QUESTIONS_TABLE }));
    return ((result.Items ?? []) as ExtractedQuestion[])
      .filter((q) => q.rfpId === rfpId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }
}

export interface BatchCreateQuestionsInput {
  rfpId: string;
  questions: Array<{
    question: string;
    section: string;
    subsection?: string;
    priority: QuestionPriority;
    requirementType?: ExtractedQuestion["requirementType"];
    pageNumber?: number;
    orderIndex: number;
  }>;
}

export async function batchCreateQuestions(
  input: BatchCreateQuestionsInput
): Promise<ExtractedQuestion[]> {
  const now = new Date().toISOString();
  const records: ExtractedQuestion[] = input.questions.map((q) => ({
    id: `q_${uuidv4()}`,
    rfpId: input.rfpId,
    question: q.question,
    section: q.section,
    subsection: q.subsection,
    priority: q.priority,
    requirementType: q.requirementType ?? "mandatory",
    pageNumber: q.pageNumber,
    orderIndex: q.orderIndex,
    createdAt: now,
  } as ExtractedQuestion & { createdAt: string }));

  // DynamoDB BatchWrite supports up to 25 items per call
  const chunks: ExtractedQuestion[][] = [];
  for (let i = 0; i < records.length; i += 25) {
    chunks.push(records.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    await db.send(
      new BatchWriteCommand({
        RequestItems: {
          [QUESTIONS_TABLE]: chunk.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      })
    );
  }

  return records;
}
