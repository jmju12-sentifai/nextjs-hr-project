import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "../components/UserMenu";

const NAV_ITEMS = [
  "직무관리",
  "채용관리",
  "평가관리",
  "보상관리",
  "배치관리",
  "복지관리",
  "교육관리",
  "행정관리",
  "기타업무",
];

const PLANS = [
  {
    name: "Free Trial",
    price: "0원",
    unit: "/14일",
    featured: false,
    features: [
      "기본 자소서 첨삭 1회",
      "JOB-FIT 진단 미리보기",
      "도구 카탈로그 열람",
    ],
    cta: "무료로 시작",
    href: "/signup",
  },
  {
    name: "Coach",
    price: "19,900원",
    unit: "/월",
    featured: true,
    badge: "가장 많이 선택",
    features: [
      "40+ AI 도구 전체",
      "자소서 진단 무제한",
      "모의면접 월 5회",
      "이메일 우선 지원",
    ],
    cta: "Coach 구독 →",
    href: "/payment?plan=coach",
  },
  {
    name: "Coach+",
    price: "49,900원",
    unit: "/월",
    featured: false,
    features: [
      "Coach 모든 기능",
      "1:1 전문가 컨설팅 월 1회",
      "모의면접 무제한",
      "전담 매니저 배정",
    ],
    cta: "Coach+ 시작",
    href: "/payment?plan=coach-plus",
  },
] as const;

export const metadata = {
  title: "구독 — HRCoach",
  description: "한 번 구독으로, 40+ AI 도구 모두.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <header className="bg-gradient-to-b from-blue-50 to-blue-50/0">
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
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm font-medium text-gray-800 transition hover:text-blue-700"
              >
                {item}
              </a>
            ))}
          </nav>
          {user ? (
            <UserMenu email={user.email ?? ""} />
          ) : (
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                로그인
              </a>
              <a
                href="/signup"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                회원가입
              </a>
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.3em] text-gray-500">
            PRICING
          </p>
          <h2 className="mb-3 text-3xl font-bold text-gray-900">
            한 번 구독으로, 40+ 도구 모두.
          </h2>
          <p className="text-sm text-gray-500">
            월 단위로 자유롭게 변경·해지할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                plan.featured
                  ? "border-blue-200 bg-white ring-2 ring-blue-100"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.featured && "badge" in plan && plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold text-blue-700 shadow-sm">
                  {plan.badge}
                </span>
              )}
              <h3
                className={`mb-3 text-base font-bold ${
                  plan.featured ? "text-blue-700" : "text-gray-900"
                }`}
              >
                {plan.name}
              </h3>
              <div className="mb-5 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                  {plan.price}
                </span>
                <span className="text-sm text-gray-500">{plan.unit}</span>
              </div>
              <ul className="mb-6 space-y-2">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-auto block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ${
                  plan.featured
                    ? "bg-blue-700 text-white hover:bg-blue-800"
                    : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-slate-800 px-8 py-7 text-white md:flex-row md:items-center">
          <div>
            <p className="text-xl font-bold leading-snug">
              합격은 운이 아닙니다.
              <br />
              준비된 사람의 결과입니다.
            </p>
            <p className="mt-2 text-xs text-slate-300">
              14일 무료 체험 · 신용카드 등록 없이 시작
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
