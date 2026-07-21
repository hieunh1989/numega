import { NextRequest, NextResponse } from "next/server";
import { handleApi, PUBLIC_USER_COLUMNS, requireAdmin, statusValue, text } from "@/lib/server/api";
import { pool } from "@/lib/server/database";
import { hashPassword } from "@/lib/server/security";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const fullName = text(body.full_name);
    const email = text(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!fullName || !email.includes("@")) return NextResponse.json({ message: "Họ tên và email hợp lệ là bắt buộc." }, { status: 400 });
    if (password && password.length < 8) return NextResponse.json({ message: "Mật khẩu mới phải có ít nhất 8 ký tự." }, { status: 400 });
    const passwordHash = password ? await hashPassword(password) : null;
    const result = await pool.query(
      `UPDATE users SET full_name=$1,email=$2,role=$3,status=$4,password_hash=COALESCE($5,password_hash),updated_at=NOW()
       WHERE id=$6 RETURNING ${PUBLIC_USER_COLUMNS}`,
      [fullName, email, body.role === "Admin" ? "Admin" : "User", statusValue(body.status), passwordHash, id],
    );
    if (!result.rowCount) return NextResponse.json({ message: "Không tìm thấy user." }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const { id } = await context.params;
    const result = await pool.query("DELETE FROM users WHERE id=$1", [id]);
    if (!result.rowCount) return NextResponse.json({ message: "Không tìm thấy user." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  });
}
