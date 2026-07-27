import { NextRequest, NextResponse } from "next/server";
import { handleApi, INGREDIENT_SELECT, requireAdmin, text } from "@/lib/server/api";
import { ingredientToExcelShape, pool } from "@/lib/server/database";
import { ingredientColumns, ingredientValues } from "@/lib/server/ingredients";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    if (!text(body["Ingredient Name"]) || !text(body["Category ID"])) {
      return NextResponse.json({ message: "Ingredient name and category are required." }, { status: 400 });
    }
    const values = ingredientValues(body, id);
    const assignments = ingredientColumns.slice(1).map((column, index) => `${column}=$${index + 2}`).join(",");
    const result = await pool.query(`UPDATE ingredients SET ${assignments}, updated_at=NOW() WHERE id=$1 RETURNING id`, values);
    if (!result.rowCount) return NextResponse.json({ message: "Ingredient not found." }, { status: 404 });
    const updated = await pool.query(`${INGREDIENT_SELECT} WHERE i.id=$1`, [id]);
    return NextResponse.json(ingredientToExcelShape(updated.rows[0]));
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const { id } = await context.params;
    const result = await pool.query("DELETE FROM ingredients WHERE id=$1", [id]);
    if (!result.rowCount) return NextResponse.json({ message: "Ingredient not found." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  });
}
