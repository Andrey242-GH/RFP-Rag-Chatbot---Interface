/**
 * POST /api/admin/users/[userId]/deactivate
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getUserById, deactivateUser } from "@/lib/dal/users";
import { writeAuditLog } from "@/lib/dal/audit";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[userId]/deactivate">
) {
  const { userId } = await ctx.params;
  const headersList = await headers();
  const adminId = headersList.get("x-user-id") ?? "system";
  const adminName = headersList.get("x-user-name") ?? "System";

  try {
    // Prevent self-deactivation
    if (userId === adminId) {
      return Response.json(
        { success: false, message: "Cannot deactivate your own account" },
        { status: 409 }
      );
    }

    const existing = await getUserById(userId);
    if (!existing) {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }

    await deactivateUser(userId);

    await writeAuditLog({
      userId: adminId,
      userName: adminName,
      action: "DEACTIVATE_USER",
      resourceType: "user",
      resourceId: userId,
      newValue: { status: "inactive" },
    }).catch(() => {});

    return Response.json({
      success: true,
      data: { id: userId, status: "inactive", updatedAt: new Date().toISOString() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to deactivate user";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
