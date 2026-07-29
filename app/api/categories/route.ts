import { NextRequest, NextResponse } from "next/server";
import { categoryIconValue, handleApi, numberValue, requireAdmin, statusValue, text } from "@/lib/server/api";
import { pool } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const calculatorOnly = request.nextUrl.searchParams.get("calculator") === "true";
    const result = await pool.query(
      `SELECT c.*, COUNT(i.id)::int AS ingredient_count
       FROM categories c LEFT JOIN ingredients i ON i.category_id=c.id
       WHERE ($1=FALSE OR (c.show_in_calculator=TRUE AND c.status='Active'))
       GROUP BY c.id ORDER BY c.sort_order, c.name`,
      [calculatorOnly],
    );
    return NextResponse.json(result.rows);
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ message: "Category name is required." }, { status: 400 });
    const generatedSlug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = text(body.slug, generatedSlug);
    const result = await pool.query(
      "INSERT INTO categories (id, slug, name, description, sort_order, status, show_in_calculator, icon) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [slug, slug, name, text(body.description), numberValue(body.sort_order), statusValue(body.status), body.show_in_calculator !== false, categoryIconValue(body.icon)],
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  });
}
