/**
 * GET /api/rfp/[id]/questions — list extracted questions for an RFP
 */
import { type NextRequest } from "next/server";
import { listQuestionsByRfpId } from "@/lib/dal/questions";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/rfp/[id]/questions">
) {
  const { id } = await ctx.params;

  try {
    const questions = await listQuestionsByRfpId(id);
    return Response.json({ success: true, data: questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch questions";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
