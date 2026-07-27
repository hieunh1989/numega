import { NextRequest, NextResponse } from "next/server";
import { handleApi, numberValue, requireAdmin, statusValue, text } from "@/lib/server/api";
import { pool } from "@/lib/server/database";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ message: "Category name is required." }, { status: 400 });
    const result = await pool.query(
      "UPDATE categories SET name=$1, description=$2, sort_order=$3, status=$4, updated_at=NOW() WHERE id=$5 RETURNING *",
      [name, text(body.description), numberValue(body.sort_order), statusValue(body.status), id],
    );
    if (!result.rowCount) return NextResponse.json({ message: "Category not found." }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const { id } = await context.params;
    const count = await pool.query("SELECT COUNT(*)::int AS count FROM ingredients WHERE category_id=$1", [id]);
    if (count.rows[0].count > 0) {
      return NextResponse.json(
        { message: "This category contains ingredients. Move them to another category first." },
        { status: 409 },
      );
    }
    const result = await pool.query("DELETE FROM categories WHERE id=$1", [id]);
    if (!result.rowCount) return NextResponse.json({ message: "Category not found." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  });
}
