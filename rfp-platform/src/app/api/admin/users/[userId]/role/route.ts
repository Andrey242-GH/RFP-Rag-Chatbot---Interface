/**
 * PATCH /api/admin/users/[userId]/role
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getUserById, updateUserRole } from "@/lib/dal/users";
import { writeAuditLog } from "@/lib/dal/audit";
import type { UserRole } from "@/types";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[userId]/role">
) {
  const { userId } = await ctx.params;
  const headersList = await headers();
  const adminId = headersList.get("x-user-id") ?? "system";
  const adminName = headersList.get("x-user-name") ?? "System";

  try {
    const { role } = await request.json() as { role?: string };

    const validRoles: UserRole[] = ["admin", "proposal_writer", "reviewer", "viewer"];
    if (!role || !validRoles.includes(role as UserRole)) {
      return Response.json(
        { success: false, message: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 422 }
      );
    }

    const existing = await getUserById(userId);
    if (!existing) {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const updated = await updateUserRole(userId, role as UserRole);

    await writeAuditLog({
      userId: adminId,
      userName: adminName,
      action: "UPDATE_USER_ROLE",
      resourceType: "user",
      resourceId: userId,
      previousValue: { role: existing.role },
      newValue: { role },
    }).catch(() => {});

    return Response.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
