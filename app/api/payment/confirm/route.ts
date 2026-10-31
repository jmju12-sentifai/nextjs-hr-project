import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
// 현행 결제창은 정기결제 등록만 사용한다. 과거 단건 승인 경로에서 별도 구독을 만들지 않는다.
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  return NextResponse.json(
    {
      message:
        "이전 결제 방식은 종료되었습니다. 결제 페이지에서 카드를 등록해 주세요. 이 요청으로 결제되지 않았습니다.",
    },
    { status: 410 },
  );
}
