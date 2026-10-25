/**
 * Session management — server-only.
 *
 * Stateless JWT sessions stored in an httpOnly cookie.
 * Uses `jose` (already a dependency) for HS256 sign/verify.
 *
 * Payload stored in the cookie:
 *   { userId, email, role, expiresAt }
 *
 * Cookie attributes:
 *   httpOnly  — not accessible to JS
 *   secure    — HTTPS only in production
 *   sameSite  — lax (protects against CSRF while allowing redirects)
 *   path      — /
 *   maxAge    — 8 hours
 */
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/types";

const SESSION_COOKIE = "rfp_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  expiresAt: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET env var is missing or too short (min 16 chars)"
    );
  }
  return new TextEncoder().encode(secret);
}

// ─── Encrypt ─────────────────────────────────────────────────

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

// ─── Decrypt ─────────────────────────────────────────────────

export async function decrypt(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───────────────────────────────────────────

export async function createSession(data: Omit<SessionPayload, "expiresAt">): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_SECONDS * 1000
  ).toISOString();
  const payload: SessionPayload = { ...data, expiresAt };
  const token = await encrypt(payload);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function refreshSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = await decrypt(token);
  if (!payload) return;

  // Re-issue with a fresh expiry
  const { expiresAt: _old, ...rest } = payload;
  await createSession(rest);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return decrypt(token);
}

// ─── Auth helper (throws on missing session) ─────────────────

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
