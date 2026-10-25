/**
 * GET /api/knowledge/stats
 */
import { type NextRequest } from "next/server";
import { getKnowledgeStats } from "@/lib/dal/knowledge";

export async function GET(_request: NextRequest) {
  try {
    const stats = await getKnowledgeStats();
    return Response.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch knowledge stats";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
