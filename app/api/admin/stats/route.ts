import { NextRequest, NextResponse } from "next/server";
import { handleApi, requireAdmin } from "@/lib/server/api";
import { pool } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const [users, ingredients, categories] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM ingredients"),
      pool.query("SELECT COUNT(*)::int AS count FROM categories"),
    ]);
    return NextResponse.json({
      users: users.rows[0].count,
      ingredients: ingredients.rows[0].count,
      categories: categories.rows[0].count,
    });
  });
}
