import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, handleApi } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ message: "Chưa đăng nhập." }, { status: 401 });
    return NextResponse.json(user);
  });
}
