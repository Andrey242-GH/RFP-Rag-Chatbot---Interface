/**
 * GET /api/rfp — list RFP documents
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { listRFPs } from "@/lib/dal/rfp";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 20));
  const status = searchParams.get("status") as Parameters<typeof listRFPs>[0]["status"] | null;

  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  const role = headersList.get("x-user-role");

  // Non-admin users only see their own RFPs
  const uploadedBy = role === "admin" ? undefined : (userId ?? undefined);

  try {
    const result = await listRFPs({ pageSize, status: status ?? undefined, uploadedBy });
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
    const message = err instanceof Error ? err.message : "Failed to list RFPs";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
