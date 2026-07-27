import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleApi, PUBLIC_USER_COLUMNS, requireAdmin, statusValue, text } from "@/lib/server/api";
import { pool } from "@/lib/server/database";
import { hashPassword } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const query = text(request.nextUrl.searchParams.get("q")).toLowerCase();
    const result = await pool.query(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users
       WHERE ($1='' OR LOWER(full_name) LIKE $2 OR LOWER(email) LIKE $2)
       ORDER BY created_at DESC`,
      [query, `%${query}%`],
    );
    return NextResponse.json(result.rows);
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const body = await request.json() as Record<string, unknown>;
    const fullName = text(body.full_name);
    const email = text(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!fullName || !email.includes("@")) return NextResponse.json({ message: "A full name and valid email are required." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ message: "Password must contain at least 8 characters." }, { status: 400 });
    const result = await pool.query(
      `INSERT INTO users (id, full_name, email, role, status, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${PUBLIC_USER_COLUMNS}`,
      [randomUUID(), fullName, email, body.role === "Admin" ? "Admin" : "User", statusValue(body.status), await hashPassword(password)],
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  });
}
