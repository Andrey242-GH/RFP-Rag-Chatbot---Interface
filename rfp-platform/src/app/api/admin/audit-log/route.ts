/**
 * GET /api/admin/audit-log
 */
import { type NextRequest } from "next/server";
import { listAuditLog } from "@/lib/dal/audit";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Number(searchParams.get("pageSize") ?? 50));
  const userId = searchParams.get("userId") ?? undefined;
  const resourceType = searchParams.get("resourceType") ?? undefined;
  const action = searchParams.get("action") ?? undefined;

  try {
    const result = await listAuditLog({ page, pageSize, userId, resourceType, action });
    return Response.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page,
        pageSize,
        hasMore: result.items.length === pageSize,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch audit log";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
