/**
 * Amazon Textract client — server-only.
 *
 * Used for async document analysis of uploaded RFP files.
 * Supports PDF and image-based documents (Textract handles both).
 *
 * Flow:
 *   1. startExtraction(s3Key) → jobId
 *   2. getExtractionResult(jobId) → { status, blocks }
 *   3. parseBlocks(blocks) → { text, tables }
 */
import "server-only";
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  type Block,
  type FeatureType,
} from "@aws-sdk/client-textract";
import { S3_BUCKET } from "@/lib/s3";

const textract = new TextractClient({
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

// ─── Start async job ──────────────────────────────────────────

export async function startExtraction(s3Key: string): Promise<string> {
  const features: FeatureType[] = ["TABLES", "FORMS"];

  const command = new StartDocumentAnalysisCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: S3_BUCKET,
        Name: s3Key,
      },
    },
    FeatureTypes: features,
  });

  const response = await textract.send(command);
  if (!response.JobId) throw new Error("Textract did not return a JobId");
  return response.JobId;
}

// ─── Poll job status ──────────────────────────────────────────

export type ExtractionStatus = "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "PARTIAL_SUCCESS";

export interface ExtractionResult {
  status: ExtractionStatus;
  blocks: Block[];
  pageCount: number;
}

export async function getExtractionResult(jobId: string): Promise<ExtractionResult> {
  const allBlocks: Block[] = [];
  let nextToken: string | undefined;
  let status: ExtractionStatus = "IN_PROGRESS";

  do {
    const command = new GetDocumentAnalysisCommand({
      JobId: jobId,
      MaxResults: 1000,
      NextToken: nextToken,
    });

    const response = await textract.send(command);
    status = (response.JobStatus as ExtractionStatus) ?? "IN_PROGRESS";

    if (status === "FAILED") {
      throw new Error(
        `Textract job ${jobId} failed: ${response.StatusMessage ?? "unknown reason"}`
      );
    }

    allBlocks.push(...(response.Blocks ?? []));
    nextToken = response.NextToken;
  } while (nextToken);

  const pageCount = allBlocks.filter((b) => b.BlockType === "PAGE").length;

  return { status, blocks: allBlocks, pageCount };
}

// ─── Parse blocks into plain text ────────────────────────────

export function extractTextFromBlocks(blocks: Block[]): string {
  return blocks
    .filter((b) => b.BlockType === "LINE" && b.Text)
    .map((b) => b.Text!)
    .join("\n");
}

// ─── Extract structured questions from text ──────────────────

export interface ParsedQuestion {
  question: string;
  section: string;
  priority: "High" | "Medium" | "Low";
  pageNumber?: number;
  orderIndex: number;
}

/**
 * Heuristic question parser.
 * Identifies lines that look like questions or numbered requirements
 * and assigns priority based on keywords.
 */
export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const questions: ParsedQuestion[] = [];
  let currentSection = "General";
  let orderIndex = 0;

  const sectionPattern = /^(section|part|requirement|category)\s+[\d.ivxlIVX]+[:\s]/i;
  const questionPattern = /^[\d]+[.)]\s+.{15,}/;
  const questionKeywords = /\b(describe|explain|provide|how|what|specify|list|include|demonstrate|address|detail)\b/i;
  const highPriorityKeywords = /\b(mandatory|required|must|shall|critical|essential|compliance|security|certif)\b/i;
  const mediumPriorityKeywords = /\b(should|preferred|important|significant)\b/i;

  for (const line of lines) {
    // Detect section headers
    if (sectionPattern.test(line) || (line.length < 80 && /^[A-Z\d]/.test(line) && !line.endsWith("?"))) {
      currentSection = line.slice(0, 60);
      continue;
    }

    // Detect questions: numbered items or lines with question keywords
    if (
      (questionPattern.test(line) && questionKeywords.test(line)) ||
      (line.endsWith("?") && line.length > 20)
    ) {
      const priority: "High" | "Medium" | "Low" = highPriorityKeywords.test(line)
        ? "High"
        : mediumPriorityKeywords.test(line)
        ? "Medium"
        : "Low";

      questions.push({
        question: line,
        section: currentSection,
        priority,
        orderIndex: orderIndex++,
      });
    }
  }

  return questions;
}
