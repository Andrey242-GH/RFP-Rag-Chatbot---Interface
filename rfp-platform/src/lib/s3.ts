/**
 * Amazon S3 client — server-only.
 *
 * Credentials resolved the same way as dynamodb.ts:
 *   1. Explicit env vars (local dev / CI)
 *   2. ECS task role (production)
 */
import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
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

export const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "rfp-platform-documents";

// ─── Upload ───────────────────────────────────────────────────

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
      ServerSideEncryption: "AES256",
    })
  );
}

// ─── Pre-signed read URL ──────────────────────────────────────

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 900 // 15 minutes
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

// ─── Pre-signed upload URL ────────────────────────────────────

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300 // 5 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

// ─── Delete ───────────────────────────────────────────────────

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}
