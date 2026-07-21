import { NextRequest, NextResponse } from "next/server";
import { handleApi, PUBLIC_USER_COLUMNS, publicUser, SESSION_COOKIE, text } from "@/lib/server/api";
import { pool } from "@/lib/server/database";
import { createSessionToken, hashSessionToken, verifyPassword } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const email = text(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const result = await pool.query(`SELECT ${PUBLIC_USER_COLUMNS}, password_hash FROM users WHERE email=$1`, [email]);
    const user = result.rows[0];

    if (!user || user.status !== "Active" || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ message: "Email hoặc mật khẩu không đúng." }, { status: 401 });
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)",
      [hashSessionToken(token), user.id, expiresAt],
    );

    const response = NextResponse.json(publicUser(user));
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    return response;
  });
}
