"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { createClient } from "@/lib/supabase/client";
// 플랜 정의는 lib/plans.ts 가 단일 소스 — 빌링 확인 라우트도 같은 표를 본다.
import { purchasablePlan } from "@/lib/plans";

const CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ??
  "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

export default function PaymentPage() {
  return (
    <Suspense fallback={null}>
      <PaymentInner />
    </Suspense>
  );
}

function PaymentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 레거시 플랜 키로 들어와도 현행 플랜으로 돌린다. 노출 금액과 결제 금액을 어긋나지 않게.
  const plan = purchasablePlan(searchParams.get("plan"));

  const paymentRef = useRef<ReturnType<
    Awaited<ReturnType<typeof loadTossPayments>>["payment"]
  > | null>(null);
  const [email, setEmail] = useState<string>("");
  const [customerKey, setCustomerKey] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const next = encodeURIComponent(`/payment?plan=${plan.key}`);
        router.replace(`/login?next=${next}`);
        return;
      }
      setEmail(user.email ?? "");
      // 토스 customerKey 는 영문/숫자/-_. 만 허용한다. 빌링키는 이 값과 쌍으로만 유효하므로
      // 발급 때 쓴 규칙을 확인 라우트에서도 똑같이 재현해야 한다.
      setCustomerKey(user.id.replace(/[^a-zA-Z0-9_\-.]/g, "_"));
      setAuthLoading(false);
    })();
  }, [router, plan.key]);

  useEffect(() => {
    if (authLoading || !customerKey) return;
    let cancelled = false;
    (async () => {
      try {
        const tossPayments = await loadTossPayments(CLIENT_KEY);
        if (cancelled) return;
        paymentRef.current = tossPayments.payment({ customerKey });
        setReady(true);
      } catch (e) {
        console.error("[Toss] SDK load failed:", e);
        setError(
          "결제 모듈을 불러오는 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, customerKey]);

  const handleRegisterCard = async () => {
    if (!paymentRef.current) return;
    setError("");
    setBusy(true);
    try {
      // 단건 결제창이 아니라 "정기결제용 카드 등록창" 을 띄운다.
      // 여기서 카드를 등록하면 authKey 를 들고 successUrl 로 돌아온다.
      await paymentRef.current.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/payment/billing/success?plan=${plan.key}`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: email || undefined,
      });
    } catch (e) {
      console.error("[Toss] requestBillingAuth failed:", e);
      const code = (e as { code?: string })?.code;
      setError(
        code === "USER_CANCEL"
          ? "카드 등록이 취소되었습니다."
          : "카드 등록 중 오류가 발생했습니다. (" +
              (e instanceof Error ? e.message : String(e)) +
              ")",
      );
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <div className="bg-gradient-to-b from-blue-50 to-blue-50/0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center">
            <Image
              src="/HRCoach_v2_transparent.png"
              alt="HRCoach"
              width={136}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </a>
          <a
            href="/pricing"
            className="text-sm font-medium text-gray-700 transition hover:text-blue-700"
          >
            요금제 보기 →
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-6 py-10">
        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-blue-700">
            CHECKOUT
          </p>
          <h1 className="text-3xl font-bold text-gray-900">정기결제 신청</h1>
          <p className="mt-2 text-sm text-gray-500">
            카드를 등록하시면 매월 자동으로 결제됩니다.
          </p>
        </header>

        <section className="mb-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                {plan.badge}
              </span>
              <h2 className="mt-3 text-lg font-bold text-gray-900">
                {plan.title}
                <span className="ml-2 text-sm font-medium text-gray-500">
                  (월 정기결제)
                </span>
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {plan.sub}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-gray-900">
                {plan.amount.toLocaleString()}
                <span className="ml-0.5 text-sm font-semibold text-gray-700">
                  원
                </span>
              </p>
              <p className="text-[11px] text-gray-400">월 / VAT 포함</p>
            </div>
          </div>
        </section>

        {/*
          카드사 심사 요건: 구매자가 서비스 제공기간과 갱신 조건을
          결제 전에 명확히 인지할 수 있어야 한다.
        */}
        <section className="mb-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-900">결제 조건 안내</h3>
          <dl className="space-y-3 text-[13px]">
            {[
              ["결제 금액", `월 ${plan.amount.toLocaleString()}원 (VAT 포함)`],
              ["서비스 제공기간", "결제일로부터 1개월"],
              ["갱신 방식", "매월 같은 날 등록하신 카드로 자동 결제"],
              ["해지 방법", "고객센터(besthrcoach@naver.com / 010-9041-9930)로 신청"],
              ["해지 시점", "해지 신청 시 다음 회차부터 청구되지 않으며, 이미 결제된 기간은 만료일까지 이용 가능"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-[88px] shrink-0 font-semibold text-gray-500">
                  {k}
                </dt>
                <dd className="flex-1 leading-relaxed text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl bg-gray-50 px-4 py-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            />
            <span className="text-[12.5px] leading-relaxed text-gray-700">
              위 정기결제 조건과{" "}
              <Link
                href="/legal/refund"
                target="_blank"
                className="font-semibold text-blue-700 underline"
              >
                환불정책
              </Link>
              에 동의합니다. (필수)
            </span>
          </label>
        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleRegisterCard}
          disabled={!ready || busy || !agreed}
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-4 text-base font-bold text-white shadow-md transition hover:from-blue-600 hover:to-blue-800 disabled:opacity-50"
        >
          {busy
            ? "카드 등록창 호출 중..."
            : `카드 등록하고 월 ${plan.amount.toLocaleString()}원 결제하기`}
        </button>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
          카드 등록 즉시 첫 회차 {plan.amount.toLocaleString()}원이 결제되며,
          이후 매월 같은 날 자동으로 결제됩니다.
          <br />
          결제는 토스페이먼츠를 통해 안전하게 처리되며, 카드 정보는 당사에 저장되지
          않습니다.
        </p>
      </div>
    </main>
  );
}
