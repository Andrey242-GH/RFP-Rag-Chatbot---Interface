/**
 * POST /api/proposals/answers/[answerId]/revert — revert to AI-generated version
 */
import { type NextRequest } from "next/server";
import { revertToAI } from "@/lib/dal/answers";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/proposals/answers/[answerId]/revert">
) {
  const { answerId } = await ctx.params;

  try {
    const updated = await revertToAI(answerId);
    if (!updated) {
      return Response.json({ success: false, message: "Answer not found" }, { status: 404 });
    }
    return Response.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revert answer";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
