import { NextResponse } from "next/server";
import { handleApi } from "@/lib/server/api";
import { pool } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleApi(async () => {
    await pool.query("SELECT 1");
    return NextResponse.json({ ok: true, service: "numega-nextjs", database: "postgresql" });
  });
}
