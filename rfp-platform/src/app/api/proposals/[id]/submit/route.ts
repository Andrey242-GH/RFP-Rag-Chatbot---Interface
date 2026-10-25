/**
 * POST /api/proposals/[id]/submit
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getProposalById, updateProposalStatus } from "@/lib/dal/proposals";
import { writeAuditLog } from "@/lib/dal/audit";
import { db, TABLES } from "@/lib/dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/submit">
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

    if (proposal.status === "submitted" || proposal.status === "approved") {
      return Response.json(
        { success: false, message: `Cannot submit a proposal in '${proposal.status}' status` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    await db.send(
      new UpdateCommand({
        TableName: TABLES.PROPOSALS,
        Key: { id },
        UpdateExpression: "SET #status = :status, submittedAt = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": "submitted", ":now": now },
        ConditionExpression: "attribute_exists(id)",
      })
    );

    await writeAuditLog({
      userId,
      userName,
      action: "SUBMIT_PROPOSAL",
      resourceType: "proposal",
      resourceId: id,
      previousValue: { status: proposal.status },
      newValue: { status: "submitted" },
    }).catch(() => {});

    return Response.json({
      success: true,
      data: { id, status: "submitted", submittedAt: now, updatedAt: now },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit proposal";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
