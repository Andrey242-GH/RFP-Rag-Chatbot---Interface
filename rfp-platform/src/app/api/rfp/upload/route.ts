/**
 * POST /api/rfp/upload
 *
 * Accepts multipart/form-data:
 *   file     — the RFP document (PDF, DOCX, TXT)
 *   metadata — JSON string with client, industry, region, submissionDate
 *
 * Production flow:
 *   1. Validate file type and size
 *   2. Stream file to S3
 *   3. Write DynamoDB record
 *   4. Start async Textract analysis job (PDF/DOCX only)
 *   5. For TXT: extract text directly and queue question extraction
 *   6. Return new RFP document
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { uploadToS3 } from "@/lib/s3";
import { createRFP, updateRFPStatus } from "@/lib/dal/rfp";
import { startExtraction, extractTextFromBlocks, getExtractionResult, parseQuestionsFromText } from "@/lib/textract";
import { batchCreateQuestions } from "@/lib/dal/questions";
import { writeAuditLog } from "@/lib/dal/audit";
import { invokeModel, GENERATION_MODEL } from "@/lib/bedrock";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "anonymous";
  const userName = headersList.get("x-user-name") ?? "Unknown";

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const metadataRaw = formData.get("metadata") as string | null;

    if (!file) {
      return Response.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return Response.json(
        { success: false, message: `Unsupported file type: ${file.type}` },
        { status: 422 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { success: false, message: "File exceeds maximum size of 50MB" },
        { status: 422 }
      );
    }

    let metadata: { client: string; industry: string; region: string; submissionDate: string } = {
      client: "Unknown",
      industry: "General",
      region: "Global",
      submissionDate: new Date().toISOString().split("T")[0],
    };
    if (metadataRaw) {
      try {
        metadata = { ...metadata, ...JSON.parse(metadataRaw) };
      } catch {
        return Response.json({ success: false, message: "Invalid metadata JSON" }, { status: 400 });
      }
    }

    const fileType = file.type.includes("pdf")
      ? "pdf"
      : file.type.includes("word")
      ? "docx"
      : "txt";

    // 1. Read file bytes
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 2. Create DynamoDB record first to get the ID
    const rfp = await createRFP({
      fileName: file.name,
      fileSize: file.size,
      fileType,
      s3Key: "", // will update after upload
      metadata,
      uploadedBy: userId,
    });

    const s3Key = `rfps/${rfp.id}/${file.name}`;

    // 3. Upload to S3
    await uploadToS3(s3Key, fileBuffer, file.type, {
      rfpId: rfp.id,
      uploadedBy: userId,
    });

    // Update s3Key in DynamoDB
    await updateRFPStatus(rfp.id, "processing", { s3Key });

    // 4. Extract text and questions based on file type
    if (fileType === "txt") {
      // Process inline for text files
      const text = fileBuffer.toString("utf-8");
      await extractQuestionsFromText(rfp.id, text, userId);
    } else {
      // Start async Textract job for PDF/DOCX
      try {
        const jobId = await startExtraction(s3Key);
        await updateRFPStatus(rfp.id, "processing", { extractionJobId: jobId });

        // Immediately poll — in a production system this would be event-driven via SNS/SQS
        // For demo: poll synchronously with timeout
        await pollAndExtract(rfp.id, jobId, metadata, userId);
      } catch (extractErr) {
        // Non-fatal: mark as extracted with no questions, user can retry
        console.error("Textract error:", extractErr);
        await updateRFPStatus(rfp.id, "extracted", {});
      }
    }

    await writeAuditLog({
      userId,
      userName,
      action: "UPLOAD_RFP",
      resourceType: "rfp",
      resourceId: rfp.id,
      newValue: { fileName: file.name, fileType, fileSize: file.size },
    }).catch(() => {});

    const finalRfp = { ...rfp, s3Key, status: "processing" as const };

    return Response.json({ success: true, data: finalRfp }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during upload";
    console.error("Upload error:", err);
    return Response.json({ success: false, message }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────

async function extractQuestionsFromText(
  rfpId: string,
  text: string,
  userId: string
): Promise<void> {
  // Use Bedrock to extract structured questions from text
  try {
    const raw = await invokeModel({
      modelId: GENERATION_MODEL,
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildExtractionPrompt(text) }],
      maxTokens: 8192,
      temperature: 0.1,
    });

    // Strip possible markdown code fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      questions: Array<{
        question: string;
        section: string;
        subsection?: string;
        priority: "High" | "Medium" | "Low";
        requirementType?: "mandatory" | "optional" | "evaluation_criteria";
      }>;
    };

    if (parsed.questions?.length > 0) {
      await batchCreateQuestions({
        rfpId,
        questions: parsed.questions.map((q, i) => ({ ...q, orderIndex: i })),
      });
    }

    await updateRFPStatus(rfpId, "extracted", {
      pageCount: Math.ceil(text.length / 3000),
    });
  } catch (err) {
    console.error("Question extraction error:", err);
    // Fall back to heuristic parsing
    const heuristicQuestions = parseQuestionsFromText(text);
    if (heuristicQuestions.length > 0) {
      await batchCreateQuestions({ rfpId, questions: heuristicQuestions });
    }
    await updateRFPStatus(rfpId, "extracted", {});
  }
}

async function pollAndExtract(
  rfpId: string,
  jobId: string,
  metadata: { client: string; industry: string },
  userId: string
): Promise<void> {
  const maxAttempts = 15;
  const pollIntervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const result = await getExtractionResult(jobId);

    if (result.status === "SUCCEEDED" || result.status === "PARTIAL_SUCCESS") {
      const text = extractTextFromBlocks(result.blocks);
      await updateRFPStatus(rfpId, "processing", {
        pageCount: result.pageCount,
      });
      await extractQuestionsFromText(rfpId, text, userId);
      return;
    }

    if (result.status === "FAILED") {
      throw new Error(`Textract extraction failed for job ${jobId}`);
    }
    // Still IN_PROGRESS — continue polling
  }

  throw new Error(`Textract job ${jobId} timed out after ${maxAttempts} attempts`);
}
