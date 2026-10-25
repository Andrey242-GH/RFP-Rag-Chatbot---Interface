/**
 * GET  /api/admin/users — list authorized users
 * POST /api/admin/users — add a new authorized user
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { listUsers, createUser, getUserByEmail } from "@/lib/dal/users";
import { writeAuditLog } from "@/lib/dal/audit";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 50));
  const search = searchParams.get("search") ?? undefined;
  const role = searchParams.get("role") ?? undefined;

  try {
    const result = await listUsers({ page, pageSize, search, role });
    return Response.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page,
        pageSize,
        hasMore: result.items.length === pageSize,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list users";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const adminId = headersList.get("x-user-id") ?? "system";
  const adminName = headersList.get("x-user-name") ?? "System";

  try {
    const { email, role, name, department } = await request.json() as {
      email?: string;
      role?: string;
      name?: string;
      department?: string;
    };

    if (!email || !role) {
      return Response.json(
        { success: false, message: "email and role are required" },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return Response.json({ success: false, message: "Invalid email address" }, { status: 422 });
    }

    const validRoles: UserRole[] = ["admin", "proposal_writer", "reviewer", "viewer"];
    if (!validRoles.includes(role as UserRole)) {
      return Response.json(
        { success: false, message: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 422 }
      );
    }

    // Check if user already exists
    const existing = await getUserByEmail(emailLower);
    if (existing) {
      return Response.json(
        { success: false, message: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const user = await createUser({
      email: emailLower,
      name: name ?? emailLower.split("@")[0],
      role: role as UserRole,
      department,
    });

    await writeAuditLog({
      userId: adminId,
      userName: adminName,
      action: "CREATE_USER",
      resourceType: "user",
      resourceId: user.id,
      newValue: { email: user.email, role: user.role },
    }).catch(() => {});

    return Response.json({ success: true, data: user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add user";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
