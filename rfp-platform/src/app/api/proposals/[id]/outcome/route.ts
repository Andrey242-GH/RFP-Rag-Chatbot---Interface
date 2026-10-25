/**
 * POST /api/proposals/[id]/outcome
 *
 * Records the customer decision (approved | rejected).
 *
 * When approved:
 *   1. Update proposal status in DynamoDB
 *   2. For each answer: create KnowledgeRecord at quality level 4
 *   3. Generate embeddings + index in OpenSearch
 *   4. Audit log the promotion
 *
 * When rejected:
 *   1. Update proposal status and store feedback
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getProposalById, recordProposalOutcome } from "@/lib/dal/proposals";
import { listAnswersByRfpId } from "@/lib/dal/answers";
import { getRFPById } from "@/lib/dal/rfp";
import { createKnowledgeRecord, updateKnowledgeEmbeddingId } from "@/lib/dal/knowledge";
import { generateEmbedding } from "@/lib/bedrock";
import { indexDocument, ensureIndexExists } from "@/lib/opensearch";
import { writeAuditLog } from "@/lib/dal/audit";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/outcome">
) {
  const { id } = await ctx.params;
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";
  const userName = headersList.get("x-user-name") ?? "System";
  const userRole = headersList.get("x-user-role");

  // Only admins and reviewers can promote content to knowledge base
  if (userRole !== "admin" && userRole !== "reviewer") {
    return Response.json(
      { success: false, message: "Admin or Reviewer role required to record outcomes" },
      { status: 403 }
    );
  }

  try {
    const { outcome, feedback } = await request.json() as {
      outcome: "approved" | "rejected";
      feedback?: string;
    };

    if (outcome !== "approved" && outcome !== "rejected") {
      return Response.json(
        { success: false, message: 'outcome must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    const proposal = await getProposalById(id);
    if (!proposal) {
      return Response.json({ success: false, message: "Proposal not found" }, { status: 404 });
    }

    // 1. Update proposal status
    await recordProposalOutcome(id, outcome, feedback);

    let knowledgeRecordsAdded = 0;

    if (outcome === "approved") {
      // 2. Fetch all answers and RFP metadata
      const answers = await listAnswersByRfpId(proposal.rfpId);
      const rfp = await getRFPById(proposal.rfpId);
      const now = new Date().toISOString();

      await ensureIndexExists();

      // 3. Ingest each answer as a KnowledgeRecord at quality level 4
      for (const answer of answers) {
        if (!answer.aiGeneratedContent) continue;

        const activeContent =
          answer.activeVersion === "human" && answer.humanEditedContent
            ? answer.humanEditedContent
            : answer.aiGeneratedContent;

        try {
          const record = await createKnowledgeRecord({
            question: answer.question,
            answer: activeContent,
            industry: rfp?.metadata.industry ?? "General",
            customer: rfp?.metadata.client ?? "Unknown",
            region: rfp?.metadata.region ?? "Global",
            domain: "rfp",
            proposalStatus: "approved",
            qualityLevel: 4, // Customer Approved
            createdBy: userId,
            approvalDate: now,
            isStrategicCustomer: false,
          });

          // 4. Generate embedding and index
          const embeddingText = `${record.question}\n\n${record.answer}`;
          const embedding = await generateEmbedding(embeddingText);

          await indexDocument({
            id: record.id,
            question: record.question,
            answer: record.answer,
            industry: record.industry,
            customer: record.customer,
            region: record.region,
            domain: record.domain,
            proposalStatus: record.proposalStatus,
            qualityLevel: record.qualityLevel,
            isStrategicCustomer: record.isStrategicCustomer ?? false,
            embedding,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          });

          await updateKnowledgeEmbeddingId(record.id, record.id);
          knowledgeRecordsAdded++;
        } catch (err) {
          console.error(`Failed to ingest answer ${answer.id} into knowledge base:`, err);
          // Non-fatal — continue with other answers
        }
      }
    }

    await writeAuditLog({
      userId,
      userName,
      action: `RECORD_OUTCOME_${outcome.toUpperCase()}`,
      resourceType: "proposal",
      resourceId: id,
      newValue: { outcome, feedback, knowledgeRecordsAdded },
    }).catch(() => {});

    return Response.json({
      success: true,
      data: {
        proposalId: id,
        outcome,
        knowledgeRecordsAdded,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record outcome";
    console.error("outcome error:", err);
    return Response.json({ success: false, message }, { status: 500 });
  }
}
