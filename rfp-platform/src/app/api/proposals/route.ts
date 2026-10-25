/**
 * GET /api/proposals — list proposals with optional filters
 */
import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { listProposals } from "@/lib/dal/proposals";
import type { ProposalStatus } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 20));
  const status = searchParams.get("status") as ProposalStatus | null;
  const search = searchParams.get("search") ?? undefined;

  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  const role = headersList.get("x-user-role");

  // Non-admin users only see their own proposals
  const createdBy = role === "admin" || role === "reviewer" ? undefined : (userId ?? undefined);

  try {
    const result = await listProposals({
      pageSize,
      status: status ?? undefined,
      search,
      createdBy,
    });

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
    const message = err instanceof Error ? err.message : "Failed to list proposals";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
