"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkSubscription } from "@/lib/subscription";

// 카탈로그는 lib/catalog.ts 로 옮겼다 — 메인 Quick Search 와 같은 원본을 봐야 하기 때문.
import {
  CATEGORY_STYLES,
  DIFY_CONFIG,
  NEW_BADGE_TOOLS,
  TOOLS,
  TOOL_ACTIVATION,
  type DifyTool,
} from "@/lib/catalog";

export default function AIToolList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDify, setActiveDify] = useState<DifyTool | null>(null);
  // Dify 모달 구독 가드 — null=확인중, true=구독자, false=비구독
  const [difySubscribed, setDifySubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!activeDify) {
      setDifySubscribed(null);
      return;
    }
    let cancelled = false;
    checkSubscription().then((ok) => {
      if (!cancelled) setDifySubscribed(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [activeDify]);

  useEffect(() => {
    const toolNo = Number(searchParams.get("tool"));
    if (!toolNo) return;
    const act = TOOL_ACTIVATION[toolNo];
    if (act?.kind === "dify") setActiveDify(act.tool);
    else if (act?.kind === "ats") router.replace("/tools/ats");
    else if (act?.kind === "eval") router.replace("/tools/eval");
  }, [searchParams, router]);

  useEffect(() => {
    console.log("[AIToolList] activeDify =", activeDify);
  }, [activeDify]);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      console.log("[AIToolList] pageshow persisted=", e.persisted);
      if (e.persisted) {
        window.location.reload();
      }
    };
    const handlePopState = (e: PopStateEvent) => {
      console.log("[AIToolList] popstate, pathname=", window.location.pathname, e);
      if (window.location.pathname === "/") {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const filtered = TOOLS;

  return (
    <div className="section-invert border-y border-[var(--sec-line)] bg-[var(--sec-bg-alt)]">
    <section className="site-wrap pb-24 pt-20">
      <div className="mb-8 text-center">
        <h2 className="mb-3 text-[30px] font-bold tracking-[-0.045em] text-[var(--sec-heading)] sm:text-[34px]">
          전체 AI 도구 리스트{" "}
          <span className="text-[var(--sec-muted)]">- 인사 전 영역의</span>{" "}
          <span className="text-[var(--accent)]">3개 AIA 엔진</span>
          <span className="text-[var(--sec-muted)]">을 한눈에</span>
        </h2>
        <p className="mx-auto max-w-2xl text-[14px] text-[var(--sec-muted)]">
          직무·채용·평가·인력운영·보상·교육·조직문화 등 모든 인사업무를 자동화하는 AI 도구 라인업입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {filtered.map((tool, idx) => {
          const cat = CATEGORY_STYLES[tool.category] ?? CATEGORY_STYLES["기타"];
          const activation = TOOL_ACTIVATION[tool.no];
          const handleClick = async () => {
            const act = TOOL_ACTIVATION[tool.no];
            if (!act) return;
            // 1) 로그인 체크 — 비로그인 사용자는 /login 으로
            const supabase = createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const next =
              act.kind === "dify"
                ? `/?tool=${tool.no}`
                : act.kind === "ats"
                  ? "/tools/ats"
                  : "/tools/eval";
            if (!user) {
              router.push(`/login?next=${encodeURIComponent(next)}`);
              return;
            }
            // 2) 로그인 사용자는 도구 바로 열기 (구독 체크 없음 — 실행 버튼이 /pricing 으로 가드)
            if (act.kind === "dify") setActiveDify(act.tool);
            else if (act.kind === "ats") router.push("/tools/ats");
            else if (act.kind === "eval") router.push("/tools/eval");
          };
          const isClickable = !!activation;
          return (
            <div
              key={`${tool.code}-${idx}`}
              className={`group relative flex flex-col overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6 transition-all ${
                isClickable
                  ? "cursor-pointer hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[var(--card-shadow)]"
                  : ""
              }`}
              onClick={isClickable ? handleClick : undefined}
            >
              {isClickable && (
                <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100" />
              )}
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="inline-block whitespace-nowrap rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]"
                >
                  {tool.category}
                </span>
                {NEW_BADGE_TOOLS.has(tool.no) && (
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--accent-on)]">
                    NEW
                  </span>
                )}
                {tool.note === "인기" && (
                  <span className="rounded bg-[var(--band-accent)] px-1.5 py-0.5 text-[10px] font-black text-[var(--band-bg)] mix-blend-normal">
                    HOT
                  </span>
                )}
              </div>

              <h3
                className={`mb-2 text-[16px] font-bold leading-snug ${
                  isClickable
                    ? "text-[var(--accent)] group-hover:underline"
                    : "text-[var(--sec-heading)] transition-colors group-hover:text-[var(--accent)]"
                }`}
              >
                {tool.name}
              </h3>

              <p className="mb-5 text-[12px] leading-relaxed text-[var(--sec-muted)]">
                {tool.definition}
              </p>

              <div className="mt-auto space-y-2 border-t border-[var(--sec-line)] pt-4 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--sec-muted)]">기존 시간</span>
                  <span className="font-medium text-[var(--sec-muted)] line-through">
                    {tool.oldTime}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--sec-muted)]">AI 시간</span>
                  <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-bold text-[var(--accent)]">
                    {tool.aiTime}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 font-medium text-[var(--sec-muted)]">산출물</span>
                  <span className="text-right font-medium text-[var(--sec-heading)]">
                    {tool.aiOutput}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-[12.5px] leading-relaxed text-[var(--sec-muted)]">
        위 리스트는 현재 제공 중인 핵심 인사 도구들입니다.
        <br />
        K Prime HR은 인사 전 영역에 걸쳐 70개 앱을 목표로 라인업을 넓혀가고 있습니다.
      </p>

      {activeDify && (
        <div className="fixed bottom-6 right-6 z-[200] flex w-[95vw] max-w-[1100px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-blue-600 p-4 text-white">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-base font-bold">{DIFY_CONFIG[activeDify].title}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveDify(null)}
              className="rounded-lg p-1 transition-colors hover:bg-white/10"
              aria-label="닫기"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="relative h-[700px] w-full overflow-hidden bg-white">
            <iframe
              src={DIFY_CONFIG[activeDify].src}
              className="h-full w-full border-0"
              title={DIFY_CONFIG[activeDify].title}
              allow="microphone"
            />
            {/* 비구독 사용자: iframe 위에 가드 오버레이 */}
            {difySubscribed === false && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
                <div className="mx-6 max-w-sm rounded-2xl border border-blue-200 bg-white p-7 text-center shadow-xl">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                    <svg
                      className="h-6 w-6 text-blue-700"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">
                    구독 후 사용 가능
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-gray-600">
                    이 도구는 구독자에게 제공됩니다.
                    <br />
                    월 3만 원 HR Pro 플랜 하나로 전체 앱을 이용하실 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/pricing")}
                    className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
                  >
                    구독하고 시작하기 →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDify(null)}
                    className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-blue-100 bg-blue-50 p-4">
            <p className="text-center text-sm font-bold leading-relaxed text-blue-900">
              {DIFY_CONFIG[activeDify].helper}
            </p>
          </div>
        </div>
      )}
    </section>
    </div>
  );
}
