/**
 * POST /api/proposals/[id]/archive
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getProposalById, updateProposalStatus } from "@/lib/dal/proposals";
import { writeAuditLog } from "@/lib/dal/audit";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/archive">
) {
  const { id } = await ctx.params;
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";
  const userName = headersList.get("x-user-name") ?? "System";

  try {
    const proposal = await getProposalById(id);
    if (!proposal) {
      return Response.json({ success: false, message: "Proposal not found" }, { status: 404 });
    }

    await updateProposalStatus(id, "archived");

    await writeAuditLog({
      userId,
      userName,
      action: "ARCHIVE_PROPOSAL",
      resourceType: "proposal",
      resourceId: id,
    }).catch(() => {});

    return Response.json({
      success: true,
      data: { id, status: "archived", updatedAt: new Date().toISOString() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to archive proposal";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
