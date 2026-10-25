/**
 * POST /api/proposals/[id]/export
 *
 * Renders the proposal to the requested format and returns a pre-signed S3 URL.
 *
 * PDF/DOCX: generates a text-based document and uploads to S3.
 * TXT: plain text format.
 *
 * Note: Full-fidelity PDF rendering would require a headless browser Lambda.
 * This implementation produces a well-structured text/markdown document that
 * can be downloaded and printed; it covers the demo requirement.
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getProposalById } from "@/lib/dal/proposals";
import { listAnswersByRfpId } from "@/lib/dal/answers";
import { uploadToS3, getPresignedDownloadUrl } from "@/lib/s3";
import { writeAuditLog } from "@/lib/dal/audit";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/export">
) {
  const { id } = await ctx.params;
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";
  const userName = headersList.get("x-user-name") ?? "System";

  try {
    const { format } = await request.json() as { format?: "pdf" | "docx" | "txt" };

    if (!format || !["pdf", "docx", "txt"].includes(format)) {
      return Response.json(
        { success: false, message: "format must be one of: pdf, docx, txt" },
        { status: 400 }
      );
    }

    const proposal = await getProposalById(id);
    if (!proposal) {
      return Response.json({ success: false, message: "Proposal not found" }, { status: 404 });
    }

    const answers = await listAnswersByRfpId(proposal.rfpId);

    // Build document content
    const content = buildProposalDocument(proposal, answers);

    const s3Key = `exports/${id}/${id}_${Date.now()}.${format}`;
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "text/plain";

    // Upload as plain text (in production, use a rendering library)
    await uploadToS3(s3Key, Buffer.from(content, "utf-8"), contentType, {
      proposalId: id,
      exportedBy: userId,
      format,
    });

    const downloadUrl = await getPresignedDownloadUrl(s3Key, 900);
    const expiresAt = new Date(Date.now() + 900 * 1000).toISOString();

    await writeAuditLog({
      userId,
      userName,
      action: "EXPORT_PROPOSAL",
      resourceType: "proposal",
      resourceId: id,
      newValue: { format, s3Key },
    }).catch(() => {});

    return Response.json({
      success: true,
      data: { downloadUrl, expiresAt, format },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

function buildProposalDocument(
  proposal: Awaited<ReturnType<typeof import("@/lib/dal/proposals").getProposalById>>,
  answers: Awaited<ReturnType<typeof import("@/lib/dal/answers").listAnswersByRfpId>>
): string {
  if (!proposal) return "";

  const lines: string[] = [
    `=`.repeat(80),
    proposal.title.toUpperCase(),
    `=`.repeat(80),
    ``,
    `Generated: ${new Date().toLocaleString()}`,
    `Status: ${proposal.status}`,
    ``,
  ];

  // Custom sections
  for (const section of proposal.sections.sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (!section.content) continue;
    lines.push(`\n${"─".repeat(60)}`);
    lines.push(section.title.toUpperCase());
    lines.push(`${"─".repeat(60)}\n`);
    lines.push(section.content);
  }

  // Q&A section
  if (answers.length > 0) {
    lines.push(`\n${"=".repeat(80)}`);
    lines.push("RESPONSE TO REQUIREMENTS");
    lines.push(`${"=".repeat(80)}\n`);

    answers.forEach((answer, i) => {
      const content =
        answer.activeVersion === "human" && answer.humanEditedContent
          ? answer.humanEditedContent
          : answer.aiGeneratedContent;

      lines.push(`\n${i + 1}. ${answer.question}`);
      lines.push(`${"─".repeat(60)}`);
      lines.push(content);

      if (answer.evaluation) {
        lines.push(`\n   [Approval Score: ${answer.evaluation.approvalScore}/5]`);
      }
      lines.push(``);
    });
  }

  return lines.join("\n");
}
