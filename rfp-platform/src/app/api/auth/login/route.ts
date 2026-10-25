/**
 * POST /api/auth/login
 *
 * Authenticates a user against the DynamoDB allowlist.
 *
 * For demo/dev environments this accepts email + password where
 * password = "dev-password" (override with AUTH_DEV_PASSWORD env var).
 *
 * For production, replace the credential check with Cognito
 * InitiateAuth → respond to challenge → get tokens.
 *
 * On success: creates a session cookie and returns the user.
 * On failure: returns 401.
 */
import { type NextRequest } from "next/server";
import { getUserByEmail, updateLastLogin } from "@/lib/dal/users";
import { createSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/dal/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return Response.json(
        { success: false, message: "email and password are required" },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Look up user in DynamoDB allowlist
    const user = await getUserByEmail(email);

    if (!user) {
      return Response.json(
        { success: false, message: "Access denied. Contact your administrator." },
        { status: 401 }
      );
    }

    // Check user is active
    const isActive = !("status" in user) || (user as { status?: string }).status !== "inactive";
    if (!isActive) {
      return Response.json(
        { success: false, message: "Account is deactivated. Contact your administrator." },
        { status: 403 }
      );
    }

    // Credential verification:
    // In production swap this for Cognito InitiateAuth.
    // For demo: accept a configurable dev password.
    const devPassword = process.env.AUTH_DEV_PASSWORD ?? "RFP-Demo-2026!";
    if (body.password !== devPassword) {
      return Response.json(
        { success: false, message: "Invalid credentials." },
        { status: 401 }
      );
    }

    // Create session cookie
    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Update last login timestamp
    await updateLastLogin(user.id).catch(() => {
      // Non-fatal; don't fail the login if this update fails
    });

    // Audit log
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: "LOGIN",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    }).catch(() => {});

    return Response.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
