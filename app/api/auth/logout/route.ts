import { NextRequest, NextResponse } from "next/server";
import { handleApi, SESSION_COOKIE } from "@/lib/server/api";
import { pool } from "@/lib/server/database";
import { hashSessionToken } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hashSessionToken(token)]);

    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
    return response;
  });
}
