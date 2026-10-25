/**
 * POST /api/proposals/assemble
 *
 * Assembles a complete proposal from all generated answers for an RFP.
 * Creates the proposal document in DynamoDB.
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createProposal } from "@/lib/dal/proposals";
import { listAnswersByRfpId, computeEditMetrics } from "@/lib/dal/answers";
import { getRFPById } from "@/lib/dal/rfp";
import { writeAuditLog } from "@/lib/dal/audit";

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";
  const userName = headersList.get("x-user-name") ?? "System";

  try {
    const { rfpId } = await request.json() as { rfpId?: string };

    if (!rfpId) {
      return Response.json({ success: false, message: "rfpId is required" }, { status: 400 });
    }

    const rfp = await getRFPById(rfpId);
    if (!rfp) {
      return Response.json({ success: false, message: "RFP not found" }, { status: 404 });
    }

    const answers = await listAnswersByRfpId(rfpId);
    const { totalAiGeneratedWords, totalHumanEditedWords, editRatio } =
      computeEditMetrics(answers);

    const proposal = await createProposal({
      rfpId,
      title: `Proposal for ${rfp.metadata.client} — ${rfp.metadata.industry}`,
      createdBy: userId,
    });

    // Update edit metrics
    // (createProposal initializes them to 0; a follow-up patch would update them
    // in production — for now these are computed on-demand from answers)

    await writeAuditLog({
      userId,
      userName,
      action: "ASSEMBLE_PROPOSAL",
      resourceType: "proposal",
      resourceId: proposal.id,
      newValue: { rfpId, answersCount: answers.length },
    }).catch(() => {});

    return Response.json(
      {
        success: true,
        data: {
          ...proposal,
          answers,
          totalAiGeneratedWords,
          totalHumanEditedWords,
          editRatio,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assemble proposal";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
