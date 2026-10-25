/**
 * Answers DAL — DynamoDB operations for generated answers.
 *
 * Table key schema:
 *   PK: id          (partition key)
 *   GSI1: rfpId     (list all answers for an RFP)
 *   GSI2: questionId
 */
import "server-only";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { db, TABLES } from "@/lib/dynamodb";
import type {
  GeneratedAnswer,
  AnswerEvaluation,
  RetrievalResult,
} from "@/types";
import { v4 as uuidv4 } from "uuid";
import { wordCount } from "@/lib/utils";

// ─── Read ──────────────────────────────────────────────────────

export async function getAnswerById(id: string): Promise<GeneratedAnswer | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLES.ANSWERS, Key: { id } })
  );
  return (result.Item as GeneratedAnswer) ?? null;
}

export async function listAnswersByRfpId(rfpId: string): Promise<GeneratedAnswer[]> {
  // GSI1 on rfpId — fall back to scan+filter for demo environments
  try {
    const result = await db.send(
      new QueryCommand({
        TableName: TABLES.ANSWERS,
        IndexName: "rfpId-index",
        KeyConditionExpression: "rfpId = :rfpId",
        ExpressionAttributeValues: { ":rfpId": rfpId },
      })
    );
    return (result.Items ?? []) as GeneratedAnswer[];
  } catch {
    // If GSI doesn't exist yet, fall back to scan
    const result = await db.send(
      new ScanCommand({ TableName: TABLES.ANSWERS })
    );
    return ((result.Items ?? []) as GeneratedAnswer[]).filter(
      (a) => a.rfpId === rfpId
    );
  }
}

// ─── Write ─────────────────────────────────────────────────────

export interface CreateAnswerInput {
  rfpId: string;
  questionId: string;
  question: string;
  aiGeneratedContent: string;
  retrievalResult: RetrievalResult;
  modelId: string;
  promptVersion?: string;
}

export async function createAnswer(input: CreateAnswerInput): Promise<GeneratedAnswer> {
  const now = new Date().toISOString();
  const answer: GeneratedAnswer = {
    id: `ans_${uuidv4()}`,
    rfpId: input.rfpId,
    questionId: input.questionId,
    question: input.question,
    aiGeneratedContent: input.aiGeneratedContent,
    activeVersion: "ai",
    versionHistory: [],
    retrievalResult: input.retrievalResult,
    modelId: input.modelId,
    promptVersion: input.promptVersion ?? "v1",
    status: "generated",
    createdAt: now,
    updatedAt: now,
  };

  await db.send(
    new PutCommand({
      TableName: TABLES.ANSWERS,
      Item: answer,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return answer;
}

export async function saveHumanEdit(
  id: string,
  content: string,
  editedBy: string,
  changeNote?: string
): Promise<GeneratedAnswer | null> {
  const answer = await getAnswerById(id);
  if (!answer) return null;

  const versionHistory = [
    ...(answer.versionHistory ?? []),
    {
      versionNumber: (answer.versionHistory?.length ?? 0) + 1,
      content: answer.humanEditedContent ?? answer.aiGeneratedContent,
      editedBy,
      editedAt: new Date().toISOString(),
      changeNote,
    },
  ];

  const result = await db.send(
    new UpdateCommand({
      TableName: TABLES.ANSWERS,
      Key: { id },
      UpdateExpression:
        "SET humanEditedContent = :content, activeVersion = :ver, versionHistory = :hist, updatedAt = :now",
      ExpressionAttributeValues: {
        ":content": content,
        ":ver": "human",
        ":hist": versionHistory,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes as GeneratedAnswer) ?? null;
}

export async function revertToAI(id: string): Promise<GeneratedAnswer | null> {
  const result = await db.send(
    new UpdateCommand({
      TableName: TABLES.ANSWERS,
      Key: { id },
      UpdateExpression: "SET activeVersion = :ver, updatedAt = :now",
      ExpressionAttributeValues: {
        ":ver": "ai",
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW",
    })
  );
  return (result.Attributes as GeneratedAnswer) ?? null;
}

export async function saveEvaluation(
  id: string,
  evaluation: AnswerEvaluation
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.ANSWERS,
      Key: { id },
      UpdateExpression: "SET evaluation = :eval, #status = :status, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":eval": evaluation,
        ":status": "reviewed",
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
    })
  );
}

export async function updateAnswerStatus(
  id: string,
  status: GeneratedAnswer["status"]
): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.ANSWERS,
      Key: { id },
      UpdateExpression: "SET #status = :status, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
    })
  );
}

// ─── Analytics helpers ────────────────────────────────────────

export function computeEditMetrics(answers: GeneratedAnswer[]): {
  totalAiGeneratedWords: number;
  totalHumanEditedWords: number;
  editRatio: number;
} {
  let totalAiGeneratedWords = 0;
  let totalHumanEditedWords = 0;

  for (const answer of answers) {
    totalAiGeneratedWords += wordCount(answer.aiGeneratedContent);
    if (answer.humanEditedContent) {
      totalHumanEditedWords += wordCount(answer.humanEditedContent);
    }
  }

  const editRatio =
    totalAiGeneratedWords > 0
      ? Math.abs(totalHumanEditedWords - totalAiGeneratedWords) /
        totalAiGeneratedWords
      : 0;

  return { totalAiGeneratedWords, totalHumanEditedWords, editRatio };
}
