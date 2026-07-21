import { NextRequest, NextResponse } from "next/server";
import { handleApi, INGREDIENT_SELECT, requireAdmin, text } from "@/lib/server/api";
import { ingredientToExcelShape, pool } from "@/lib/server/database";
import { ingredientColumns, ingredientValues } from "@/lib/server/ingredients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const query = text(request.nextUrl.searchParams.get("q")).toLowerCase();
    const category = text(request.nextUrl.searchParams.get("category"));
    const activeOnly = request.nextUrl.searchParams.get("active") === "true";
    const result = await pool.query(
      `${INGREDIENT_SELECT}
       WHERE ($1='' OR LOWER(i.name) LIKE $2 OR LOWER(i.id) LIKE $2 OR LOWER(i.scientific_name) LIKE $2)
       AND ($3='' OR i.category_id=$3) AND ($4=FALSE OR i.status='Active')
       ORDER BY c.sort_order, i.name`,
      [query, `%${query}%`, category, activeOnly],
    );
    return NextResponse.json(result.rows.map(ingredientToExcelShape));
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const body = await request.json() as Record<string, unknown>;
    const id = text(body["Ingredient ID"]).toUpperCase();
    if (!id || !text(body["Ingredient Name"]) || !text(body["Category ID"])) {
      return NextResponse.json({ message: "Mã, tên và danh mục nguyên liệu là bắt buộc." }, { status: 400 });
    }
    const values = ingredientValues(body, id);
    await pool.query(
      `INSERT INTO ingredients (${ingredientColumns.join(",")}) VALUES (${ingredientColumns.map((_, index) => `$${index + 1}`).join(",")})`,
      values,
    );
    const result = await pool.query(`${INGREDIENT_SELECT} WHERE i.id=$1`, [id]);
    return NextResponse.json(ingredientToExcelShape(result.rows[0]), { status: 201 });
  });
}
