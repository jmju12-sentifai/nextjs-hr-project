import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * 카드 등록창이 authKey 를 들고 돌아오는 착지점.
 *
 * 여기서 곧바로 서버 라우트를 불러 billingKey 발급 + 첫 회차 청구를 끝낸다.
 * 브라우저에서 직접 토스 API 를 부르지 않는 이유는 시크릿 키가 필요하기 때문이다.
 */

type SearchParams = {
  customerKey?: string;
  authKey?: string;
  plan?: string;
};

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { customerKey, authKey, plan } = searchParams;

  if (!customerKey || !authKey) {
    redirect("/payment/fail?message=missing_params");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hdrs = await headers();
  const host = hdrs.get("host")!;
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const cookie = hdrs.get("cookie") ?? "";

  const res = await fetch(`${proto}://${host}/api/payment/billing/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ customerKey, authKey, plan }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    redirect(
      `/payment/fail?message=${encodeURIComponent(err.message ?? "billing_failed")}`,
    );
  }

  const { nextBillingAt, amount } = (await res.json()) as {
    nextBillingAt?: string;
    amount?: number;
  };

  const nextLabel = nextBillingAt
    ? new Date(nextBillingAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        정기결제가 시작되었습니다
      </h1>
      <p className="mb-2 text-sm text-gray-500">
        첫 회차 {amount?.toLocaleString() ?? ""}원 결제가 완료되었습니다.
      </p>
      {nextLabel && (
        <p className="mb-8 text-sm text-gray-500">
          다음 결제 예정일은 <strong className="text-gray-800">{nextLabel}</strong>
          입니다.
        </p>
      )}
      <a
        href="/"
        className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        도구로 돌아가기
      </a>
    </main>
  );
}
