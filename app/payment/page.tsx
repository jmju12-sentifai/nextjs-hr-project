"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { createClient } from "@/lib/supabase/client";

const CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ??
  "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

type PlanKey = "coach" | "coach-plus";

const PLANS: Record<
  PlanKey,
  { badge: string; title: string; sub: string; amount: number }
> = {
  coach: {
    badge: "Coach",
    title: "HRcoach Coach 플랜",
    sub: "40+ AI 도구 전체 · 자소서 진단 무제한 · 모의면접 월 5회",
    amount: 19900,
  },
  "coach-plus": {
    badge: "Coach+",
    title: "HRcoach Coach+ 플랜",
    sub: "Coach 모든 기능 · 1:1 전문가 컨설팅 월 1회 · 모의면접 무제한 · 전담 매니저 배정",
    amount: 49900,
  },
};

function generateOrderId(planKey: PlanKey) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `order_${planKey}_${Date.now()}_${rand}`;
}

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
  const planKey: PlanKey =
    searchParams.get("plan") === "coach-plus" ? "coach-plus" : "coach";
  const plan = PLANS[planKey];

  const widgetsRef = useRef<Awaited<
    ReturnType<Awaited<ReturnType<typeof loadTossPayments>>["widgets"]>
  > | null>(null);
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const next = encodeURIComponent(`/payment?plan=${planKey}`);
        router.replace(`/login?next=${next}`);
        return;
      }
      setEmail(user.email ?? "");
      setUserId(user.id);
      setAuthLoading(false);
    })();
  }, [router, planKey]);

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const tossPayments = await loadTossPayments(CLIENT_KEY);
        if (cancelled) return;
        const safeKey = userId.replace(/[^a-zA-Z0-9_\-.]/g, "_");
        const widgets = tossPayments.widgets({ customerKey: safeKey });
        await widgets.setAmount({ currency: "KRW", value: plan.amount });
        await Promise.all([
          widgets.renderPaymentMethods({
            selector: "#payment-method",
            variantKey: "DEFAULT",
          }),
          widgets.renderAgreement({
            selector: "#agreement",
            variantKey: "AGREEMENT",
          }),
        ]);
        if (cancelled) return;
        widgetsRef.current = widgets;
        setReady(true);
      } catch (e) {
        console.error(e);
        setError(
          "결제 위젯을 불러오는 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, plan.amount]);

  const handlePay = async () => {
    if (!widgetsRef.current) return;
    setError("");
    setBusy(true);
    try {
      const orderId = generateOrderId(planKey);
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: plan.title,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: email || undefined,
      });
    } catch (e) {
      console.error("[Toss] requestPayment failed:", e);
      const code = (e as { code?: string })?.code;
      const message =
        code === "NEED_AGREEMENT_WITH_REQUIRED_TERMS"
          ? "결제 진행을 위해 약관에 동의해 주세요."
          : "결제 요청 중 오류가 발생했습니다. (" +
            (e instanceof Error ? e.message : String(e)) +
            ")";
      setError(message);
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
          <h1 className="text-3xl font-bold text-gray-900">결제하기</h1>
          <p className="mt-2 text-sm text-gray-500">
            선택하신 HRcoach 구독 플랜의 결제를 진행합니다.
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
                  (월 구독)
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
              <p className="text-[11px] text-gray-400">VAT 포함</p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div id="payment-method" />
          <div id="agreement" className="mt-4" />
        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handlePay}
          disabled={!ready || busy}
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-4 text-base font-bold text-white shadow-md transition hover:from-blue-600 hover:to-blue-800 disabled:opacity-50"
        >
          {busy
            ? "결제창 호출 중..."
            : `${plan.amount.toLocaleString()}원 결제하기`}
        </button>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
          본 결제는 토스페이먼츠 결제 시스템을 통해 진행되며, 현재는 PG사 심사를
          위한 테스트 환경입니다.
          <br />
          테스트 카드 정보로 결제 진행 시 실제 금액은 청구되지 않습니다.
        </p>
      </div>
    </main>
  );
}
