import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase, pool } from "./database";
import { hashSessionToken } from "./security";

export const SESSION_COOKIE = "numega_session";
export const PUBLIC_USER_COLUMNS = "id, full_name, email, role, status, created_at, updated_at";
export const INGREDIENT_SELECT = "SELECT i.*, c.name AS category_name FROM ingredients i JOIN categories c ON c.id = i.category_id";

export type PublicUser = {
  id: string;
  full_name: string;
  email: string;
  role: "Admin" | "User";
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
};

export function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function statusValue(value: unknown): "Active" | "Inactive" {
  return value === "Inactive" ? "Inactive" : "Active";
}

export function numberValue(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export async function authenticatedUser(request: NextRequest): Promise<PublicUser | null> {
  await ensureDatabase();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const columns = PUBLIC_USER_COLUMNS.split(", ").map((column) => `u.${column}`).join(", ");
  const result = await pool.query(
    `SELECT ${columns} FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.status='Active'`,
    [hashSessionToken(token)],
  );
  return (result.rows[0] as PublicUser | undefined) || null;
}

export async function requireAdmin(request: NextRequest) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ message: "Vui lòng đăng nhập để tiếp tục." }, { status: 401 });
  if (user.role !== "Admin") return NextResponse.json({ message: "Tài khoản không có quyền quản trị." }, { status: 403 });
  return null;
}

export async function handleApi(action: () => Promise<Response>) {
  try {
    await ensureDatabase();
    return await action();
  } catch (error) {
    console.error(error);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return NextResponse.json({ message: "Dữ liệu đã tồn tại hoặc bị trùng." }, { status: 409 });
    if (code === "23503") return NextResponse.json({ message: "Danh mục được chọn không tồn tại." }, { status: 400 });
    return NextResponse.json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." }, { status: 500 });
  }
}

export function publicUser(user: Record<string, unknown>) {
  return Object.fromEntries(PUBLIC_USER_COLUMNS.split(", ").map((column) => [column, user[column]]));
}
