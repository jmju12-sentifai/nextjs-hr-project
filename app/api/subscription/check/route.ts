import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { hasMemberAccess } from "@/lib/members/server";
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ active: await hasMemberAccess(auth.user.id) });
  } catch {
    return NextResponse.json(
      { error: "이용 상태를 확인하지 못했습니다." },
      { status: 503 },
    );
  }
}
