import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import SiteHeader from "../components/home/SiteHeader";
import { LISTED_PLANS } from "@/lib/plans";

export const metadata = {
  title: "요금 및 구독 — HRcoach",
  description: "연 30만 원 고정 구독으로 인사기능별 앱 전체를.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <div className="site-wrap">
        <SiteHeader userEmail={user?.email ?? null} isAdmin={isAdminEmail(user?.email)} bordered />
      </div>

      <section className="site-wrap pb-24 pt-16">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.3em] text-gray-500">
            PRICING
          </p>
          <h2 className="mb-3 text-3xl font-bold text-brand-ink">
            연 30만 원, 하나의 고정 구독
          </h2>
          <p className="text-sm text-brand-muted">
            중소기업(SME) 플랜 · 구독 기간 중 추가되는 앱까지 그대로 포함됩니다.
          </p>
        </div>

        <div className="mx-auto grid max-w-3xl gap-5">
          {LISTED_PLANS.map((plan) => (
            <div
              key={plan.key}
              className="flex flex-col gap-8 rounded-3xl border border-brand-line bg-white p-8 shadow-[0_28px_60px_-45px_rgba(7,28,68,0.6)] sm:flex-row sm:items-center"
            >
              <div className="sm:w-[42%]">
                <span className="inline-block rounded-full bg-[#eef4ff] px-3 py-1 text-[10px] font-black tracking-wider text-brand-blue">
                  {plan.badge}
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[38px] font-bold tracking-[-0.04em] text-brand-ink">
                    {plan.amount.toLocaleString()}원
                  </span>
                  <span className="text-sm text-brand-muted">{plan.unit}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-brand-muted">{plan.sub}</p>
                <Link
                  href={`/payment?plan=${plan.key}`}
                  className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-blue px-5 py-3.5 text-[12px] font-black text-white transition hover:bg-brand-blue2"
                >
                  구독 시작하기 →
                </Link>
              </div>
              <ul className="flex-1 space-y-3 border-t border-[#eef2f8] pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-brand-ink">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-slate-800 px-8 py-7 text-white md:flex-row md:items-center">
          <div>
            <p className="text-xl font-bold leading-snug">
              인사 업무의 판단 근거를,
              <br />
              사람이 아니라 기준이 만들게.
            </p>
            <p className="mt-2 text-xs text-slate-300">
              기준 문서만 올리면 검토부터 산출물까지 이어집니다.
            </p>
          </div>
          <Link
            href="/signup"
            className="rounded-lg border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            무료로 시작하기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
