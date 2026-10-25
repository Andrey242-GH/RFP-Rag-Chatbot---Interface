/**
 * GET /api/admin/analytics
 */
import { type NextRequest } from "next/server";
import { listProposals } from "@/lib/dal/proposals";
import { listUsers } from "@/lib/dal/users";
import { getKnowledgeStats } from "@/lib/dal/knowledge";

export async function GET(_request: NextRequest) {
  try {
    const [proposalsResult, usersResult, knowledgeStats] = await Promise.all([
      listProposals({ pageSize: 500 }),
      listUsers({ pageSize: 500 }),
      getKnowledgeStats(),
    ]);

    const proposals = proposalsResult.items;
    const totalProposals = proposals.length;
    const approvedProposals = proposals.filter((p) => p.status === "approved").length;
    const rejectedProposals = proposals.filter((p) => p.status === "rejected").length;
    const approvalRate =
      totalProposals > 0
        ? Math.round((approvedProposals / totalProposals) * 100)
        : 0;

    const scoredProposals = proposals.filter((p) => p.overallScore != null);
    const averageScore =
      scoredProposals.length > 0
        ? Math.round(
            (scoredProposals.reduce((s, p) => s + (p.overallScore ?? 0), 0) /
              scoredProposals.length) *
              10
          ) / 10
        : 0;

    // Monthly trend (last 6 months)
    const now = new Date();
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const monthProposals = proposals.filter((p) => {
        const pd = new Date(p.createdAt);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      });
      return {
        month,
        submitted: monthProposals.filter((p) => p.status === "submitted" || p.status === "approved" || p.status === "rejected").length,
        approved: monthProposals.filter((p) => p.status === "approved").length,
      };
    }).reverse();

    // Active users this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activeUsersThisWeek = usersResult.items.filter(
      (u) => u.lastLoginAt && u.lastLoginAt > oneWeekAgo
    ).length;

    return Response.json({
      success: true,
      data: {
        totalProposals,
        approvedProposals,
        rejectedProposals,
        approvalRate,
        averageScore,
        totalUsers: usersResult.total,
        activeUsersThisWeek,
        totalKnowledgeRecords: knowledgeStats.totalRecords,
        proposalsByMonth: monthlyTrend,
        knowledgeByQualityLevel: knowledgeStats.byQualityLevel,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch analytics";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
