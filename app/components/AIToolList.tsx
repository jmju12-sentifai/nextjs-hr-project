"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkSubscription } from "@/lib/subscription";

type Tool = {
  no: number;
  category: string;
  code: string;
  name: string;
  definition: string;
  oldTime: string;
  aiOutput: string;
  aiTime: string;
  note: string;
};

const TOOLS: Tool[] = [
  { no: 1, category: "직무", code: "A01", name: "직무분석/직무기술서 생성기", definition: "현업관리자/인사담당이 직무 업무유형 질문에 맞게 답변을 하고, 회사기준을 업로드하면 자동으로 직무분석 결과 및 직무 기술서를 생성함 (성과책임 및 역량모델, 직무평가 포함)", oldTime: "2박3일", aiOutput: "직무분석결과 및 직무기술서", aiTime: "12분", note: "" },
  { no: 2, category: "채용", code: "B02", name: "지원자 직무적합도 ATS 레포트 생성기", definition: "직무 모집요강과 지원자 이력서를 업로드하면, 지원자 개인에 대한 직무 적합도 평가기준별 점수와 채용가부 의견 등 종합레포트를 자동 제공함", oldTime: "인당 10분", aiOutput: "직무적합도 ATS레포트", aiTime: "2분", note: "인기" },
  { no: 3, category: "평가", code: "C02", name: "조직별 평가결과 현황표 도출기", definition: "본부단위 구성원 평가표를 업로드하면, 평가등급 배분 전체 현황과 직급별·팀별·직무별 분포도 수준에 대한 레포트를 제공", oldTime: "3시간", aiOutput: "조직별 평가레포트", aiTime: "5분", note: "" },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  "직무": { bg: "bg-blue-50", text: "text-blue-600" },
  "채용": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "평가": { bg: "bg-violet-50", text: "text-violet-600" },
  "인력운영": { bg: "bg-orange-50", text: "text-orange-600" },
  "보상/복지": { bg: "bg-sky-50", text: "text-sky-600" },
  "교육": { bg: "bg-teal-50", text: "text-teal-600" },
  "조직문화": { bg: "bg-rose-50", text: "text-rose-500" },
  "기타": { bg: "bg-gray-100", text: "text-gray-500" },
};

type DifyTool = "report-summary";
type Activation = { kind: "dify"; tool: DifyTool } | { kind: "ats" } | { kind: "eval" };

const DIFY_CONFIG: Record<DifyTool, { title: string; src: string; helper: string }> = {
  "report-summary": {
    title: "보고서/자료 요약기",
    src: "https://udify.app/workflow/wiiyddzOMb3Wq8QA",
    helper: "요약할 보고서/자료 파일을 업로드한 후 실행을 눌러 주세요.",
  },
};

const TOOL_ACTIVATION: Record<number, Activation> = {
  1: { kind: "dify", tool: "report-summary" },
  2: { kind: "ats" },
  3: { kind: "eval" },
};

const NEW_BADGE_TOOLS = new Set([2, 3]);

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
    <div className="bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200/70">
    <section className="mx-auto max-w-6xl px-6 pb-48 pt-32">
      <div className="mb-8 text-center">
        <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
          전체 AI 도구 리스트{" "}
          <span className="text-gray-500">- 인사 전 영역의</span>{" "}
          <span className="text-blue-700">3개 AIA 엔진</span>
          <span className="text-gray-500">을 한눈에</span>
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-gray-500">
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
              className={`group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all ${
                isClickable
                  ? "cursor-pointer hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                  : ""
              }`}
              onClick={isClickable ? handleClick : undefined}
            >
              {isClickable && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-emerald-500 to-violet-400 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
              <div className="mb-4 flex items-center gap-2">
                <span
                  className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${cat.bg} ${cat.text}`}
                >
                  {tool.category}
                </span>
                {NEW_BADGE_TOOLS.has(tool.no) && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    NEW
                  </span>
                )}
                {tool.note === "인기" && (
                  <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    HOT
                  </span>
                )}
              </div>

              <h3
                className={`mb-2 text-base font-bold leading-snug ${
                  isClickable
                    ? "text-blue-600 group-hover:underline"
                    : "text-gray-900 transition-colors group-hover:text-blue-600"
                }`}
              >
                {tool.name}
              </h3>

              <p className="mb-5 text-xs leading-relaxed text-gray-500">
                {tool.definition}
              </p>

              <div className="mt-auto space-y-2 border-t border-gray-100 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-400">기존 시간</span>
                  <span className="font-medium text-gray-500 line-through">
                    {tool.oldTime}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-400">AI 시간</span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                    {tool.aiTime}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 font-medium text-gray-400">산출물</span>
                  <span className="text-right font-medium text-gray-700">
                    {tool.aiOutput}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
        위 리스트는 현재 제공 중인 핵심 인사 도구들입니다.
        <br />
        K Prime HR은 이외에도 조직 관리, 성과 평가, 보상 체계 등 100개 이상의 AIA를 개발하고 있습니다.
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
                    이 도구는 Coach 이상 구독자에게 제공됩니다.
                    <br />
                    한 번 구독으로 40+ 도구 모두 사용 가능.
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
