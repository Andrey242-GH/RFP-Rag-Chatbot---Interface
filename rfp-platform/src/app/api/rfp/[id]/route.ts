/**
 * GET   /api/rfp/[id]   — fetch a single RFP document
 * PATCH /api/rfp/[id]   — update RFP metadata
 */
import { type NextRequest } from "next/server";
import { getRFPById, updateRFPStatus } from "@/lib/dal/rfp";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/rfp/[id]">
) {
  const { id } = await ctx.params;

  try {
    const rfp = await getRFPById(id);
    if (!rfp) {
      return Response.json({ success: false, message: "RFP not found" }, { status: 404 });
    }
    return Response.json({ success: true, data: rfp });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch RFP";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/rfp/[id]">
) {
  const { id } = await ctx.params;

  try {
    const body = await request.json() as Record<string, unknown>;
    const rfp = await getRFPById(id);
    if (!rfp) {
      return Response.json({ success: false, message: "RFP not found" }, { status: 404 });
    }

    // Only allow updating metadata fields
    const allowed = ["metadata", "status"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (updates.status) {
      await updateRFPStatus(id, updates.status as Parameters<typeof updateRFPStatus>[1], {});
    }

    const updated = await getRFPById(id);
    return Response.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update RFP";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
