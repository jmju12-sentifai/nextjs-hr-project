import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SectionShell from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";
import { HR_CATEGORIES, TOOLS, type HrCategory } from "@/lib/catalog";

export const metadata = { title: "K Prime Lab — HRcoach" };
export const dynamic = "force-dynamic";

/**
 * 엑셀 8번 — 비전 및 미션 / R&D 로드맵.
 *
 * ⚠️ 비전·미션 문구는 푸터 문장을 확장한 초안이다. 확정 원고를 받으면 교체하면 된다.
 * 로드맵은 목표 앱 수가 확정된 자료가 없어 숫자를 적지 않는다.
 * 대신 카테고리별 실제 보유 현황을 DB 에서 세어 "어디까지 왔는지" 로 보여준다.
 */
export default async function LabPage() {
  const viewer = await getViewer();
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from("apps")
    .select("app_schema")
    .eq("status", "published");

  const counts = new Map<HrCategory, number>();
  for (const t of TOOLS) counts.set(t.hrCategory, (counts.get(t.hrCategory) ?? 0) + 1);
  for (const row of apps ?? []) {
    const raw = (row as any).app_schema?.meta?.category;
    const cat = HR_CATEGORIES.find((c) => c === raw) ?? "기타관리";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const covered = [...counts.values()].filter((n) => n > 0).length;
  const max = Math.max(1, ...counts.values());

  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="K PRIME LAB"
      title="인사 컨설팅을 도구로 바꿉니다."
      lead="컨설턴트의 머릿속에만 있던 판단 기준을, 누구나 실행할 수 있는 앱으로 옮기는 일을 합니다."
    >
      <section className="mb-16 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-7">
          <p className="text-[11px] font-black tracking-[0.16em] text-[var(--accent)]">MISSION</p>
          <h2 className="mt-3 break-keep text-[19px] font-bold leading-snug text-[var(--sec-heading)]">
            복잡한 블랙박스를 걷어내고,
            <br />
            누구나 실행 가능한 도구로.
          </h2>
          <p className="mt-3.5 break-keep text-[13px] leading-[1.9] text-[var(--sec-muted)]">
            인사 판단은 오래 경험한 사람의 감각에 기대 왔습니다. 그래서 담당자가 바뀌면 기준도
            흔들립니다. 우리는 그 기준을 문서에서 꺼내 도구에 심어, 누가 처리하든 같은 결론이
            나오게 만듭니다.
          </p>
        </div>
        <div className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-7">
          <p className="text-[11px] font-black tracking-[0.16em] text-[var(--accent)]">VISION</p>
          <h2 className="mt-3 break-keep text-[19px] font-bold leading-snug text-[var(--sec-heading)]">
            기업의 성장은 데이터와
            <br />
            로직 위에 세워져야 합니다.
          </h2>
          <p className="mt-3.5 break-keep text-[13px] leading-[1.9] text-[var(--sec-muted)]">
            인사 전 영역의 반복 업무를 앱으로 옮겨, 담당자가 판단이 필요한 일에만 시간을 쓰게 하는
            것이 목표입니다. 규모가 작은 조직도 큰 조직과 같은 수준의 인사 기준을 쓸 수 있어야
            합니다.
          </p>
        </div>
      </section>

      <section id="roadmap" className="mb-14 scroll-mt-28">
        <h2 className="mb-1.5 text-[20px] font-bold tracking-[-0.035em] text-[var(--sec-heading)]">
          R&amp;D 로드맵
        </h2>
        <p className="mb-6 text-[13px] text-[var(--sec-muted)]">
          현재 {HR_CATEGORIES.length}개 인사 영역 중 {covered}개 영역에서 {total}개의 앱과 도구가
          동작하고 있습니다. 나머지 영역도 순차적으로 채워갑니다.
        </p>

        <div className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)]">
          {HR_CATEGORIES.map((c) => {
            const n = counts.get(c) ?? 0;
            return (
              <div
                key={c}
                className="flex items-center gap-4 border-b border-[var(--sec-line)] px-6 py-4 last:border-b-0"
              >
                <span className="w-[150px] shrink-0 text-[13px] font-bold text-[var(--sec-heading)]">
                  {c}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--sec-line)]">
                  <span
                    className="block h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: n ? `${Math.max(8, (n / max) * 100)}%` : "0%" }}
                  />
                </span>
                <span className="w-[68px] shrink-0 text-right text-[12px] font-bold">
                  {n > 0 ? (
                    <span className="text-[var(--sec-heading)]">{n}개 운영</span>
                  ) : (
                    <span className="text-[var(--sec-muted)]">준비 중</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] text-[var(--sec-muted)]">
          목표 앱 수와 시점은 확정되는 대로 공개합니다. 먼저 필요한 앱이 있다면{" "}
          <Link href="/requests" className="font-bold text-[var(--accent)] underline">
            앱개발요청
          </Link>
          에 남겨주세요 — 투표가 많은 요청부터 개발합니다.
        </p>
      </section>
    </SectionShell>
  );
}
