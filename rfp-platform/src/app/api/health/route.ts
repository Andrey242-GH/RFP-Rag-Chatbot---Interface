import type { NextRequest } from "next/server";


export async function GET(_req: NextRequest) {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
    environment: process.env.NODE_ENV ?? "development",
  });
}
