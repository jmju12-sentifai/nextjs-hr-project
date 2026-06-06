import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  paymentKey?: string;
  orderId?: string;
  amount?: string;
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { paymentKey, orderId, amount } = searchParams;

  if (!paymentKey || !orderId || !amount) {
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

  const res = await fetch(`${proto}://${host}/api/payment/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    redirect(
      `/payment/fail?message=${encodeURIComponent(err.message ?? "confirm_failed")}`,
    );
  }

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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">결제가 완료되었습니다</h1>
      <p className="mb-8 text-sm text-gray-500">
        이제 모든 AI 도구를 자유롭게 이용하실 수 있습니다.
      </p>
      <a
        href="/"
        className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        도구로 돌아가기
      </a>
    </main>
  );
}
