/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
import { deleteSession } from "@/lib/session";
import { getSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/dal/audit";

export async function POST() {
  try {
    const session = await getSession();

    if (session) {
      await writeAuditLog({
        userId: session.userId,
        userName: session.name,
        action: "LOGOUT",
        resourceType: "user",
        resourceId: session.userId,
      }).catch(() => {});
    }

    await deleteSession();

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Logout failed";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
