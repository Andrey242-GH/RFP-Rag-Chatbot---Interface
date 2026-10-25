/**
 * PATCH /api/proposals/[id]/sections/[sectionId]
 */
import { type NextRequest } from "next/server";
import { updateProposalSection } from "@/lib/dal/proposals";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/sections/[sectionId]">
) {
  const { id, sectionId } = await ctx.params;
  const { content } = await request.json() as { content?: string };

  if (typeof content !== "string") {
    return Response.json({ success: false, message: "content must be a string" }, { status: 400 });
  }

  try {
    await updateProposalSection(id, sectionId, content);
    return Response.json({
      success: true,
      data: { id, sectionId, content, updatedAt: new Date().toISOString() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update section";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
