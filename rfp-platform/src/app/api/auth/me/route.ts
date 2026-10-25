/**
 * GET /api/auth/me
 * Returns the current authenticated user from the session.
 */
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/dal/users";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }

  // Fetch fresh user data from DynamoDB to get current role/status
  const user = await getUserById(session.userId).catch(() => null);

  if (!user) {
    return Response.json({ success: false, message: "User not found" }, { status: 404 });
  }

  // Check still active
  const isActive = !("status" in user) || (user as { status?: string }).status !== "inactive";
  if (!isActive) {
    return Response.json({ success: false, message: "Account is deactivated" }, { status: 403 });
  }

  return Response.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        lastLoginAt: user.lastLoginAt,
      },
    },
  });
}
