import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import SiteHeader from "../components/home/SiteHeader";
import { LISTED_PLANS } from "@/lib/plans";

export const metadata = {
  title: "요금 및 구독 — HRcoach",
  description: "월 3만 원 정기결제로 인사기능별 앱 전체를.",
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
            월 3만 원, 하나의 정기결제
          </h2>
          <p className="text-sm text-brand-muted">
            HR Pro 플랜 · 구독 기간 중 추가되는 앱까지 그대로 포함됩니다.
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
                <p className="mt-3 text-[11px] leading-relaxed text-brand-muted">
                  매월 자동결제 · 언제든 해지 가능
                </p>
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

        {/*
          카드사 심사 필수 요건 — 구매자가 서비스 제공기간·갱신·해지 조건을
          상품 페이지에서 바로 확인할 수 있어야 한다.
          (토스페이먼츠 계약심사 안내 "판매정책 기재" 항목)
        */}
        <section className="mx-auto mt-10 max-w-3xl rounded-2xl border border-brand-line bg-white p-8">
          <h3 className="mb-5 text-base font-bold text-brand-ink">판매 및 이용 정책</h3>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {[
              ["상품 구분", "온라인 서비스 이용권 (디지털 콘텐츠)"],
              ["결제 방식", "신용카드 정기결제 (빌링)"],
              ["결제 금액", "월 30,000원 (VAT 포함)"],
              ["서비스 제공기간", "결제일로부터 1개월"],
              ["제공 시점", "결제 완료 즉시 이용 가능"],
              ["갱신 방식", "매월 같은 날 등록된 카드로 자동 결제"],
              [
                "해지 방법",
                "고객센터(besthrcoach@naver.com / 010-9041-9930)로 신청",
              ],
              [
                "해지 효력",
                "다음 회차부터 청구 중단, 결제된 기간은 만료일까지 이용 가능",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="mb-1 text-[11px] font-bold tracking-wide text-brand-muted">
                  {k}
                </dt>
                <dd className="text-[13px] leading-relaxed text-brand-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 border-t border-[#eef2f8] pt-5 text-[12px] leading-relaxed text-brand-muted">
            환불은{" "}
            <Link href="/legal/refund" className="font-semibold text-brand-blue underline">
              환불정책
            </Link>
            에 따라 처리됩니다. 본 서비스는 온라인으로 제공되는 디지털 콘텐츠로
            별도의 배송 절차가 없습니다.
          </p>
        </section>

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
