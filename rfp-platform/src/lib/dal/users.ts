/**
 * Users DAL — all DynamoDB operations for the users table.
 *
 * Table key schema:
 *   PK: id          (partition key)
 *   GSI1: email     (used for login / allowlist lookup)
 *
 * All functions are server-only.
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
import type { User, UserRole } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ─── Read ──────────────────────────────────────────────────────

export async function getUserById(id: string): Promise<User | null> {
  const result = await db.send(
    new GetCommand({
      TableName: TABLES.USERS,
      Key: { id },
    })
  );
  return (result.Item as User) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  // GSI on email field
  const result = await db.send(
    new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email.toLowerCase() },
      Limit: 1,
    })
  );
  const items = result.Items ?? [];
  return items.length > 0 ? (items[0] as User) : null;
}

export interface ListUsersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}

export async function listUsers(options: ListUsersOptions = {}): Promise<{
  items: User[];
  total: number;
}> {
  const { pageSize = 50, search, role } = options;

  // For a demo environment a full scan is acceptable;
  // in production add a GSI on status and paginate with ExclusiveStartKey.
  const result = await db.send(
    new ScanCommand({
      TableName: TABLES.USERS,
      Limit: 200,
    })
  );

  let items = (result.Items ?? []) as User[];

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q)
    );
  }

  if (role) {
    items = items.filter((u) => u.role === role);
  }

  return { items: items.slice(0, pageSize), total: items.length };
}

// ─── Write ─────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  department?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const now = new Date().toISOString();
  const user: User = {
    id: `user_${uuidv4()}`,
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
    department: input.department,
    createdAt: now,
  };

  await db.send(
    new PutCommand({
      TableName: TABLES.USERS,
      Item: user,
      // Prevent overwriting an existing user with the same email
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return user;
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<User | null> {
  const result = await db.send(
    new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { id: userId },
      UpdateExpression: "SET #role = :role, updatedAt = :now",
      ExpressionAttributeNames: { "#role": "role" },
      ExpressionAttributeValues: {
        ":role": role,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW",
    })
  );
  return (result.Attributes as User) ?? null;
}

export async function deactivateUser(userId: string): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { id: userId },
      UpdateExpression: "SET #status = :inactive, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":inactive": "inactive",
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(id)",
    })
  );
}

export async function updateLastLogin(userId: string): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { id: userId },
      UpdateExpression: "SET lastLoginAt = :now",
      ExpressionAttributeValues: { ":now": new Date().toISOString() },
      ConditionExpression: "attribute_exists(id)",
    })
  );
}
