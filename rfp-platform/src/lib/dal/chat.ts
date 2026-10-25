/**
 * Chat Sessions DAL — DynamoDB operations.
 *
 * Stores full conversation history per session.
 * Table key schema:
 *   PK: id   (session id)
 */
import "server-only";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLES } from "@/lib/dynamodb";
import type { ChatSession, ChatMessage } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const result = await db.send(
    new GetCommand({ TableName: TABLES.CHAT_SESSIONS, Key: { id: sessionId } })
  );
  return (result.Item as ChatSession) ?? null;
}

export async function createChatSession(
  userId: string,
  rfpId?: string,
  proposalId?: string
): Promise<ChatSession> {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: `sess_${uuidv4()}`,
    userId,
    rfpId,
    proposalId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  await db.send(
    new PutCommand({
      TableName: TABLES.CHAT_SESSIONS,
      Item: session,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return session;
}

export async function appendMessages(
  sessionId: string,
  userId: string,
  newMessages: ChatMessage[],
  rfpId?: string,
  proposalId?: string
): Promise<ChatSession> {
  // Upsert: create if not exists, append messages if it does
  let session = await getSession(sessionId);

  if (!session) {
    session = await createChatSession(userId, rfpId, proposalId);
  }

  const updatedMessages = [...session.messages, ...newMessages];

  const result = await db.send(
    new UpdateCommand({
      TableName: TABLES.CHAT_SESSIONS,
      Key: { id: sessionId },
      UpdateExpression: "SET messages = :msgs, updatedAt = :now",
      ExpressionAttributeValues: {
        ":msgs": updatedMessages,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes as ChatSession;
}
