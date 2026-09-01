"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkSubscription } from "@/lib/subscription";
import { DIFY_CONFIG, TOOL_ACTIVATION, type DifyTool } from "@/lib/catalog";

/**
 * 도구 실행 진입점.
 *
 * 화면에는 아무것도 그리지 않고 ?tool= 만 처리한다.
 * 원래 이 로직은 홈의 "전체 AI 도구 리스트"(AIToolList) 안에 들어 있었는데,
 * 그 섹션이 카탈로그와 중복되어 제거되면서 여기로 떼어냈다.
 * 이걸 같이 지웠으면 /?tool=1 로 여는 Dify 도구가 통째로 끊긴다.
 */
export default function ToolLauncher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDify, setActiveDify] = useState<DifyTool | null>(null);
  // null=확인중, true=구독자, false=비구독
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
    if (!act) return;

    if (act.kind === "ats") {
      router.replace("/tools/ats");
      return;
    }
    if (act.kind === "eval") {
      router.replace("/tools/eval");
      return;
    }

    // Dify 도구는 로그인한 사용자에게만 연다. 구독 여부는 모달 위 가드가 처리한다.
    void (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/?tool=${toolNo}`)}`);
        return;
      }
      setActiveDify(act.tool);
    })();
  }, [searchParams, router]);

  // 뒤로가기·bfcache 복귀 시 상태가 어긋나는 문제 — 기존 동작을 유지한다.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    const onPopState = () => {
      if (window.location.pathname === "/") window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return (
    <>
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
    </>
  );
}
