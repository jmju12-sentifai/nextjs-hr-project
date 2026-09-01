import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  HR_CATEGORIES,
  toolsToSearchItems,
  type HrCategory,
  type SearchItem,
} from "@/lib/catalog";
import { LISTED_PLANS } from "@/lib/plans";
import AIToolList from "../components/AIToolList";
import CurationBoard from "../components/home/CurationBoard";
import Hero from "../components/home/Hero";

export const metadata = {
  title: "메인 리디자인 시안 — HRcoach",
  robots: { index: false, follow: false },
};

/**
 * 운영 메인(/)과 분리된 리디자인 시안.
 * 구성은 HRcoach_Menu_Structure_20260810.xlsx 의 Home 행을 따른다.
 *   Hero Section / Quick Search / Curation Board
 * 그 아래로 인사기능별 진입, 도구 리스트, 로드맵 배너, 요금, CTA 를 잇는다.
 */

/** 발행 앱의 카테고리 추정 — 스키마에 값이 있으면 쓰고, 없으면 이름으로 유추한다. */
const CATEGORY_HINTS: [HrCategory, string[]][] = [
  ["직무 분석 및 설계", ["직무", "직무기술서", "역량"]],
  ["채용 및 온보딩", ["채용", "지원자", "이력서", "온보딩", "공모", "면접"]],
  ["평가 및 성과 관리", ["평가", "성과", "인사위원회", "이의신청", "피드백"]],
  ["보상관리", ["보상", "수당", "급여", "연봉", "퇴직금", "연차보상"]],
  ["복리후생관리", ["복리", "경조사", "복지"]],
  ["교육관리", ["교육", "연수", "리더십"]],
  ["조직문화/진단", ["조직문화", "진단", "서베이"]],
  ["급여/근태/행정관리", ["근태", "근로", "출장", "행정", "계약"]],
  ["인사정보관리", ["인사정보", "인사기록", "발령"]],
];

/** 여러 후보 중 내용이 있는 첫 문자열 */
function firstText(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function guessCategory(name: string, explicit?: unknown): HrCategory {
  if (typeof explicit === "string") {
    const hit = HR_CATEGORIES.find((c) => c === explicit);
    if (hit) return hit;
  }
  for (const [cat, keys] of CATEGORY_HINTS) {
    if (keys.some((k) => name.includes(k))) return cat;
  }
  return "기타관리";
}

export default async function DraftHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = isAdminEmail(user?.email);

  // 관리자 빌더에서 발행한 앱 — 최신순으로 받아 큐레이션과 검색 색인에 함께 쓴다.
  const { data: publishedApps } = await supabase
    .from("apps")
    .select("id, name, app_schema, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const appItems: SearchItem[] = (publishedApps || []).map((row: any) => {
    const meta = row.app_schema?.meta || {};
    const title: string = meta.appName || row.name || "Untitled";
    return {
      id: `app-${row.id}`,
      kind: "app" as const,
      title,
      category: guessCategory(title, meta.category),
      // 빌더가 채우는 meta 를 그대로 쓴다. 없을 때만 4단계 흐름의 마지막 항목으로 대신한다.
      summary: firstText(meta.tagline, meta.purpose, meta.problem) ?? "",
      output: firstText(meta.output, Array.isArray(meta.flow) ? meta.flow[3] : "") ?? "산출 결과",
      href: `/apps/${row.id}`,
    };
  });

  const toolItems = toolsToSearchItems();
  const searchItems: SearchItem[] = [...appItems, ...toolItems];

  // 추천 = 배지 달린 도구 우선, 신규 = 최근 발행 앱 우선
  const recommended = [
    ...toolItems.filter((t) => t.badge),
    ...appItems,
    ...toolItems.filter((t) => !t.badge),
  ].slice(0, 8);
  const updated = [...appItems, ...toolItems].slice(0, 8);

  // 카테고리별 보유 개수 — 0건인 칩도 로드맵을 보여주기 위해 노출하되 흐리게 처리한다.
  const countByCategory = new Map<HrCategory, number>();
  for (const it of searchItems) {
    countByCategory.set(it.category, (countByCategory.get(it.category) ?? 0) + 1);
  }
  const coveredCategories = countByCategory.size;

  return (
    <div className="min-h-screen bg-[var(--sec-bg)]">
      <Hero
        userEmail={user?.email ?? null}
        isAdmin={admin}
        searchItems={searchItems}
      />

      <CurationBoard recommended={recommended} updated={updated} />

      {/* 인사기능별 앱 — 엑셀 비고 "통합검색 메뉴에서 기능별로만 구분" */}
      <section className="section-invert border-y border-[var(--sec-line)] bg-[var(--sec-bg-alt)]">
        <div className="site-wrap py-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[var(--accent)]">
                BY HR FUNCTION
              </p>
              <h2 className="text-[28px] font-bold tracking-[-0.045em] text-[var(--sec-heading)]">
                인사기능별로 찾기
              </h2>
            </div>
            <Link
              href="/apps"
              className="text-[12px] font-bold text-[var(--sec-muted)] transition hover:text-[var(--accent)]"
            >
              전체 앱 보기 →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {HR_CATEGORIES.map((cat) => {
              const n = countByCategory.get(cat) ?? 0;
              return (
                <Link
                  key={cat}
                  href={`/apps?cat=${encodeURIComponent(cat)}`}
                  className={`flex items-center gap-2 rounded-[var(--chip-radius)] border px-4 py-2.5 text-[12.5px] font-bold transition ${
                    n > 0
                      ? "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      : "border-transparent bg-[var(--card-bg)]/50 text-[var(--sec-muted)] opacity-60"
                  }`}
                >
                  {cat}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      n > 0
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "bg-[var(--sec-line)] text-[var(--sec-muted)]"
                    }`}
                  >
                    {n}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <AIToolList />

      {/* 엑셀 Home > Hero Section 의 로드맵 배너.
          목표 앱 수는 확정된 자료가 없어 하드코딩하지 않고, 현재 보유 수와
          커버 중인 영역 수를 DB 에서 세어 그대로 보여준다. */}
      <section className="site-wrap pb-20">
        <div className="band overflow-hidden px-8 py-10 sm:px-12">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="min-w-[280px] flex-1">
              <p className="band-accent mb-3 text-[11px] font-black tracking-[0.2em]">
                R&amp;D ROADMAP
              </p>
              <h2 className="text-[30px] font-bold leading-tight tracking-[-0.05em] sm:text-[38px]">
                지금 {searchItems.length}개,
                <br />
                <span className="band-accent">계속 넓어집니다.</span>
              </h2>
              <p className="mt-4 max-w-[460px] text-[14px] leading-relaxed opacity-70">
                {coveredCategories}개 인사 영역에서 {searchItems.length}개의 앱과 도구가 동작하고
                있고, 나머지 영역도 순차적으로 채워가고 있습니다. 구독 기간 중 추가되는 앱은 별도
                비용 없이 그대로 이용하실 수 있습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/lab"
                className="rounded-xl bg-[var(--accent)] px-6 py-3.5 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
              >
                로드맵 보기 →
              </Link>
              <Link
                href="/requests"
                className="rounded-xl border border-current/25 px-6 py-3.5 text-[13px] font-bold opacity-80 transition hover:opacity-100"
              >
                앱 개발 요청
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 요금 — 엑셀 "HR Pro · 월 30,000원(전체 앱)" (앱 회원 및 과금정책.xlsx) */}
      <section id="pricing" className="site-wrap scroll-mt-20 pb-24">
        <div className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[var(--accent)]">
            PRICING
          </p>
          <h2 className="text-[30px] font-bold tracking-[-0.045em] text-[var(--sec-heading)] sm:text-[34px]">
            월 3만 원, 하나의 정기결제
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] text-[var(--sec-muted)]">
            앱을 하나씩 결제하지 않습니다. 한 번 구독하면 인사기능별 앱 전체와 이후 추가되는 앱까지
            그대로 쓰실 수 있습니다.
          </p>
        </div>

        <div className="mx-auto grid max-w-3xl gap-5">
          {LISTED_PLANS.map((plan) => (
            <div
              key={plan.key}
              className="flex flex-col gap-8 rounded-[var(--band-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-8 shadow-[var(--card-shadow)] sm:flex-row sm:items-center"
            >
              <div className="sm:w-[42%]">
                <span className="inline-block rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-black tracking-wider text-[var(--accent)]">
                  {plan.badge}
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[40px] font-bold tracking-[-0.04em] text-[var(--sec-heading)]">
                    {plan.amount.toLocaleString()}원
                  </span>
                  <span className="text-sm text-[var(--sec-muted)]">{plan.unit}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--sec-muted)]">{plan.sub}</p>
                <Link
                  href={`/payment?plan=${plan.key}`}
                  className="mt-6 flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3.5 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
                >
                  구독 시작하기 →
                </Link>
              </div>
              <ul className="flex-1 space-y-3 border-t border-[var(--sec-line)] pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-[var(--sec-fg)]">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
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

        <p className="mt-6 text-center text-[12px] text-[var(--sec-muted)]">
          프리미엄 앱(제휴 심리검사·노무법인 연계, ERP 연동형)은 건별 결제 및 크레딧으로 별도
          운영됩니다.{" "}
          <Link href="/premium" className="font-bold text-[var(--accent)] underline">
            프리미엄앱 안내
          </Link>
        </p>

        <div className="band mt-12 flex flex-col items-start justify-between gap-5 px-8 py-9 md:flex-row md:items-center">
          <div>
            <p className="text-[24px] font-bold leading-snug tracking-[-0.03em]">
              인사 업무의 판단 근거를,
              <br />
              사람이 아니라 기준이 만들게.
            </p>
            <p className="mt-2.5 text-[13px] opacity-70">
              기준 문서만 올리면 검토부터 산출물까지 이어집니다.
            </p>
          </div>
          <Link
            href="/signup"
            className="shrink-0 rounded-xl bg-[var(--accent)] px-7 py-3.5 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
          >
            무료로 시작하기 →
          </Link>
        </div>
      </section>

      {/* Footer 는 app/layout.tsx 에서 모든 페이지에 자동 렌더링 */}
    </div>
  );
}
