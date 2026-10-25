/**
 * GET /api/chat/[sessionId] — load chat history for a session
 */
import { type NextRequest } from "next/server";
import { getSession } from "@/lib/dal/chat";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/chat/[sessionId]">
) {
  const { sessionId } = await ctx.params;

  try {
    const session = await getSession(sessionId);

    if (!session) {
      return Response.json({
        success: true,
        data: {
          session: { id: sessionId, createdAt: new Date().toISOString() },
          messages: [],
        },
      });
    }

    return Response.json({
      success: true,
      data: { session, messages: session.messages },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load session";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
