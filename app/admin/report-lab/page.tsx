"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { AppSchema, Path } from "app-renderer";
import { activePathOf, run } from "app-renderer";
import DocReport from "@/app/admin/builder/components/DocReport";
import { SAMPLE_WAGE_PEAK } from "@/app/admin/builder/lib/sample-wagepeak";
import { SAMPLE_ISSUER, showcaseDoc, wagePeakNoticeDoc } from "@/app/admin/builder/lib/sample-wagepeak-doc";

// 관리자 · 문서형 리포트 견본
//   임금피크제 샘플 앱의 테스트 값으로 계산한 결과를 문서형 양식으로 그려 본다.
//   AI 양식 제안·대화형 편집이 붙기 전까지 렌더러를 확인하는 화면이다.

const TABS = [
  { key: "notice", label: "임금피크제 안내서 (A안)", make: wagePeakNoticeDoc },
  { key: "showcase", label: "표현 양식 견본", make: showcaseDoc },
] as const;

export default function ReportLabPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("notice");

  const view = useMemo(() => {
    const base = run(SAMPLE_WAGE_PEAK);
    const path = activePathOf(SAMPLE_WAGE_PEAK, base.activePathId) as Path;
    const doc = TABS.find((t) => t.key === tab)!.make(path);
    const schema: AppSchema = {
      ...SAMPLE_WAGE_PEAK,
      paths: (SAMPLE_WAGE_PEAK.paths || []).map((p) => (p.id === path.id ? { ...p, doc } : p)),
    };
    return { schema, path: { ...path, doc }, result: base };
  }, [tab]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 px-4 pb-14 pt-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-blue-700">관리자 · 리포트</div>
            <h1 className="text-2xl font-bold text-gray-900">문서형 리포트 견본</h1>
            <p className="mt-1 text-sm text-gray-500">
              임금피크제 샘플 앱의 테스트 값으로 계산했습니다. 회사명·인물·금액은 모두 가상의 예시입니다.
            </p>
          </div>
          <Link
            href="/admin/applist"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            앱 리스트
          </Link>
        </div>

        <div className="mb-5 flex w-fit flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition " +
                (tab === t.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <DocReport
          schema={view.schema}
          path={view.path}
          result={view.result}
          issuer={SAMPLE_ISSUER}
          issuedAt={String(view.result.sc["기준일"] ?? "") || undefined}
        />
      </div>
    </main>
  );
}
