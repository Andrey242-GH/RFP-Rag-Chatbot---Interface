/**
 * GET /api/proposals/analytics
 */
import { type NextRequest } from "next/server";
import { listProposals } from "@/lib/dal/proposals";

export async function GET(_request: NextRequest) {
  try {
    const result = await listProposals({ pageSize: 500 });
    const proposals = result.items;

    const totalProposals = proposals.length;
    const approvedProposals = proposals.filter((p) => p.status === "approved").length;
    const rejectedProposals = proposals.filter((p) => p.status === "rejected").length;
    const pendingProposals = proposals.filter(
      (p) => !["approved", "rejected", "archived"].includes(p.status)
    ).length;

    const scoredProposals = proposals.filter((p) => p.overallScore != null);
    const averageApprovalScore =
      scoredProposals.length > 0
        ? Math.round(
            (scoredProposals.reduce((s, p) => s + (p.overallScore ?? 0), 0) /
              scoredProposals.length) *
              10
          ) / 10
        : 0;

    const winRate =
      totalProposals > 0
        ? Math.round((approvedProposals / totalProposals) * 100)
        : 0;

    const editableProposals = proposals.filter((p) => p.totalAiGeneratedWords > 0);
    const averageEditRatio =
      editableProposals.length > 0
        ? editableProposals.reduce((s, p) => s + p.editRatio, 0) / editableProposals.length
        : 0;

    return Response.json({
      success: true,
      data: {
        totalProposals,
        approvedProposals,
        rejectedProposals,
        pendingProposals,
        averageApprovalScore,
        winRate,
        averageEditRatio: Math.round(averageEditRatio * 100) / 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch analytics";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
