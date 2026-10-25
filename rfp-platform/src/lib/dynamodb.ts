/**
 * DynamoDB client — server-only.
 *
 * Uses the AWS SDK v3 DynamoDBDocumentClient for marshalling/unmarshalling.
 * Credentials are resolved from the environment in this order:
 *   1. AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars (local dev, CI)
 *   2. ECS task role / EC2 instance profile (production — no keys needed)
 */
import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  // LocalStack override: set DYNAMODB_ENDPOINT_URL=http://localhost:4566
  ...(process.env.DYNAMODB_ENDPOINT_URL
    ? { endpoint: process.env.DYNAMODB_ENDPOINT_URL }
    : {}),
  ...(process.env.AWS_ACCESS_KEY_ID
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
          sessionToken: process.env.AWS_SESSION_TOKEN,
        },
      }
    : {}),
});

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    // Store undefined attributes by omitting them (don't write NULL)
    removeUndefinedValues: true,
  },
});

// ─── Table names ──────────────────────────────────────────────

export const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE ?? "rfp-platform-users",
  PROPOSALS: process.env.DYNAMODB_PROPOSALS_TABLE ?? "rfp-platform-proposals",
  RFP: process.env.DYNAMODB_RFP_TABLE ?? "rfp-platform-rfp-documents",
  ANSWERS: process.env.DYNAMODB_ANSWERS_TABLE ?? "rfp-platform-answers",
  KNOWLEDGE: process.env.DYNAMODB_KNOWLEDGE_TABLE ?? "rfp-platform-knowledge",
  AUDIT_LOG: process.env.DYNAMODB_AUDIT_LOG_TABLE ?? "rfp-platform-audit-log",
  CHAT_SESSIONS:
    process.env.DYNAMODB_CHAT_SESSIONS_TABLE ?? "rfp-platform-chat-sessions",
} as const;
