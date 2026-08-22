import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  HR_CATEGORIES,
  toolsToSearchItems,
  type HrCategory,
  type SearchItem,
} from "@/lib/catalog";
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
  searchParams: { cat?: string };
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
      summary:
        typeof meta.description === "string" && meta.description.trim()
          ? meta.description
          : "기준 지식화 → 파싱 → 적정성 판단 → 안내·이행의 4단계로 처리되는 인사 앱입니다.",
      output:
        typeof meta.output === "string" && meta.output.trim()
          ? meta.output
          : "검토 결과 및 안내자료",
      href: `/apps/${row.id}`,
    };
  });

  const all = [...appItems, ...toolsToSearchItems()];
  const active = HR_CATEGORIES.find((c) => c === searchParams.cat);
  const shown = active ? all.filter((it) => it.category === active) : all;

  const countBy = new Map<HrCategory, number>();
  for (const it of all) countBy.set(it.category, (countBy.get(it.category) ?? 0) + 1);

  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="BY HR FUNCTION"
      title="인사기능별 앱."
      lead="필요한 업무 영역을 고르면 바로 실행할 수 있는 앱과 도구가 나옵니다."
    >
      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/apps"
          className={`rounded-full border px-4 py-2.5 text-[12px] font-bold transition ${
            active
              ? "border-brand-line bg-white text-brand-ink hover:border-brand-blue"
              : "border-brand-ink bg-brand-ink text-white"
          }`}
        >
          전체 {all.length}
        </Link>
        {HR_CATEGORIES.map((cat) => {
          const n = countBy.get(cat) ?? 0;
          const on = cat === active;
          return (
            <Link
              key={cat}
              href={`/apps?cat=${encodeURIComponent(cat)}`}
              className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-bold transition ${
                on
                  ? "border-brand-ink bg-brand-ink text-white"
                  : n > 0
                    ? "border-brand-line bg-white text-brand-ink hover:border-brand-blue hover:text-brand-blue"
                    : "border-transparent bg-[#f4f7fb] text-[#a9b6c9]"
              }`}
            >
              {cat}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  on
                    ? "bg-white/20 text-white"
                    : n > 0
                      ? "bg-[#eef4ff] text-brand-blue"
                      : "bg-[#eaeef4] text-[#b3bfd0]"
                }`}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-line bg-[#f9fbfe] px-6 py-16 text-center">
          <p className="text-sm font-bold text-brand-ink">
            {active ?? "이"} 영역의 앱은 아직 준비 중입니다.
          </p>
          <p className="mt-2 text-[12px] text-brand-muted">
            필요한 앱을{" "}
            <Link href="/requests" className="font-bold text-brand-blue underline">
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
              className="group flex min-h-[190px] flex-col rounded-2xl border border-brand-line bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-blue hover:shadow-[0_28px_50px_-30px_rgba(7,28,68,0.45)]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[9px] font-black text-brand-blue">
                  {it.kind === "tool" ? "TOOL" : "APP"}
                </span>
                <span className="text-[10px] font-bold text-brand-muted">{it.category}</span>
                {it.badge && (
                  <span className="ml-auto rounded bg-brand-blue px-1.5 py-0.5 text-[9px] font-black text-white">
                    {it.badge}
                  </span>
                )}
              </div>
              <h2 className="break-keep text-[15px] font-bold leading-snug text-brand-ink">
                {it.title}
              </h2>
              <p className="mt-2 line-clamp-3 break-keep text-[11px] leading-relaxed text-brand-muted">
                {it.summary}
              </p>
              <div className="mt-auto flex items-center justify-between border-t border-[#eef2f8] pt-4">
                <span className="text-[10px] text-brand-muted">산출물</span>
                <span className="max-w-[70%] truncate text-right text-[11px] font-bold text-brand-ink">
                  {it.output}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
