/**
 * GET   /api/proposals/[id] — fetch a single proposal with all answers
 * PATCH /api/proposals/[id] — update proposal metadata
 */
import { type NextRequest } from "next/server";
import { getProposalById, updateProposalStatus } from "@/lib/dal/proposals";
import { listAnswersByRfpId } from "@/lib/dal/answers";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]">
) {
  const { id } = await ctx.params;

  try {
    const proposal = await getProposalById(id);
    if (!proposal) {
      return Response.json({ success: false, message: "Proposal not found" }, { status: 404 });
    }

    // Enrich with answers if not already stored on the proposal
    if (proposal.answers.length === 0 && proposal.rfpId) {
      const answers = await listAnswersByRfpId(proposal.rfpId);
      proposal.answers = answers;
    }

    return Response.json({ success: true, data: proposal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch proposal";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]">
) {
  const { id } = await ctx.params;

  try {
    const body = await request.json() as Record<string, unknown>;
    const proposal = await getProposalById(id);
    if (!proposal) {
      return Response.json({ success: false, message: "Proposal not found" }, { status: 404 });
    }

    if (body.status) {
      await updateProposalStatus(id, body.status as Parameters<typeof updateProposalStatus>[1]);
    }

    const updated = await getProposalById(id);
    return Response.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update proposal";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
