import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  HR_CATEGORIES,
  filterSearchItems,
  toolsToSearchItems,
  type HrCategory,
  type SearchItem,
} from "@/lib/catalog";
import FlowSteps from "../components/home/FlowSteps";
import SectionShell from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = {
  title: "인사기능별 앱 — HRcoach",
  description: "직무·채용·평가·보상·복리후생·교육·조직문화·근태행정 앱을 기능별로.",
};

/** 메인과 같은 규칙 — 발행 앱의 카테고리를 스키마 값 또는 이름으로 정한다. */
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

export default async function AppsPage({
  searchParams,
}: {
  searchParams: { cat?: string; q?: string };
}) {
  const viewer = await getViewer();
  const supabase = await createClient();
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
      flow: Array.isArray(meta.flow) ? meta.flow.filter((f: unknown) => typeof f === "string" && f.trim()) : [],
      href: `/apps/${row.id}`,
    };
  });

  const all = [...appItems, ...toolsToSearchItems()];
  const active = HR_CATEGORIES.find((c) => c === searchParams.cat);
  // 홈 검색창의 "앱 검색" 버튼이 ?q= 로 넘어온다. 같은 필터 함수를 그대로 쓴다.
  const q = (searchParams.q ?? "").trim();
  const byQuery = q ? filterSearchItems(all, q) : all;
  const shown = active ? byQuery.filter((it) => it.category === active) : byQuery;

  const countBy = new Map<HrCategory, number>();
  for (const it of byQuery) countBy.set(it.category, (countBy.get(it.category) ?? 0) + 1);

  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow={q ? "SEARCH RESULTS" : "BY HR FUNCTION"}
      title={q ? `‘${q}’ 검색 결과` : "인사기능별 앱."}
      lead={
        q
          ? `제목·설명·산출물·카테고리에서 찾았습니다. ${byQuery.length}건.`
          : "필요한 업무 영역을 고르면 바로 실행할 수 있는 앱과 도구가 나옵니다."
      }
    >
      {q && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-5 py-4">
          <span className="text-[12.5px] text-[var(--sec-muted)]">
            검색어 <b className="text-[var(--sec-heading)]">{q}</b>
          </span>
          <Link
            href="/apps"
            className="ml-auto text-[12px] font-bold text-[var(--accent)] underline"
          >
            검색 해제
          </Link>
        </div>
      )}
      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href={q ? `/apps?q=${encodeURIComponent(q)}` : "/apps"}
          className={`rounded-[var(--chip-radius)] border px-4 py-2.5 text-[12.5px] font-bold transition ${
            active
              ? "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)]"
              : "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
          }`}
        >
          전체 {byQuery.length}
        </Link>
        {HR_CATEGORIES.map((cat) => {
          const n = countBy.get(cat) ?? 0;
          const on = cat === active;
          return (
            <Link
              key={cat}
              href={`/apps?cat=${encodeURIComponent(cat)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`flex items-center gap-2 rounded-[var(--chip-radius)] border px-4 py-2.5 text-[12.5px] font-bold transition ${
                on
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
                  : n > 0
                    ? "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    : "border-transparent bg-[var(--sec-bg-alt)] text-[var(--sec-muted)] opacity-60"
              }`}
            >
              {cat}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  on
                    ? "bg-white/20 text-current"
                    : n > 0
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

      {shown.length === 0 ? (
        <div className="rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-6 py-16 text-center">
          <p className="text-sm font-bold text-[var(--sec-heading)]">
            {q ? `‘${q}’ 에 해당하는 앱이 없습니다.` : `${active ?? "이"} 영역의 앱은 아직 준비 중입니다.`}
          </p>
          <p className="mt-2 text-[13px] text-[var(--sec-muted)]">
            필요한 앱을{" "}
            <Link href="/requests" className="font-bold text-[var(--accent)] underline">
              직접 요청
            </Link>
            하시면 우선순위에 반영합니다.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((it) => (
            <Link
              key={it.id}
              href={it.href}
              className="group flex min-h-[195px] flex-col rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[var(--card-shadow)]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-black text-[var(--accent)]">
                  {it.kind === "tool" ? "TOOL" : "APP"}
                </span>
                <span className="text-[11px] font-bold text-[var(--sec-muted)]">{it.category}</span>
                {it.badge && (
                  <span className="ml-auto rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-black text-[var(--accent-on)]">
                    {it.badge}
                  </span>
                )}
              </div>
              <h2 className="break-keep text-[16px] font-bold leading-snug text-[var(--sec-heading)]">
                {it.title}
              </h2>
              <p className="mt-2 line-clamp-3 break-keep text-[12px] leading-relaxed text-[var(--sec-muted)]">
                {it.summary}
              </p>
              {it.flow && it.flow.length > 0 ? (
                <div className="mt-auto border-t border-[var(--sec-line)] pt-3">
                  <FlowSteps flow={it.flow} />
                </div>
              ) : (
                <div className="mt-auto flex items-center justify-between border-t border-[var(--sec-line)] pt-4">
                  <span className="text-[11px] text-[var(--sec-muted)]">산출물</span>
                  <span className="max-w-[70%] truncate text-right text-[12px] font-bold text-[var(--sec-heading)]">
                    {it.output}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
