/**
 * PATCH /api/proposals/answers/[answerId] — save a human edit
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { saveHumanEdit } from "@/lib/dal/answers";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/proposals/answers/[answerId]">
) {
  const { answerId } = await ctx.params;
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "system";

  const { content, changeNote } = await request.json() as {
    content?: string;
    changeNote?: string;
  };

  if (typeof content !== "string") {
    return Response.json({ success: false, message: "content is required" }, { status: 400 });
  }

  try {
    const updated = await saveHumanEdit(answerId, content, userId, changeNote);
    if (!updated) {
      return Response.json({ success: false, message: "Answer not found" }, { status: 404 });
    }
    return Response.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save edit";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
