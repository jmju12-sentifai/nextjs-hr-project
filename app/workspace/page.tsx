import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SectionShell, { PlannedList } from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "내 작업실 — HRcoach" };

/**
 * 엑셀 "4. 내 작업실".
 * 하위 항목이 전부 내 데이터라 대메뉴가 아닌 프로필 메뉴에서만 진입한다.
 *
 * 산출물 보관함은 아직 만들지 않는다 — app_runs 는 PII 보호를 위해 메타데이터만 넣고 있어
 * 생성된 문서를 다시 내려줄 수단이 없다. 지금은 "언제 무엇을 돌렸는지" 이력만 보여준다.
 */

type Run = {
  id: string;
  app_id: string | null;
  status: string | null;
  created_at: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function relDays(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return "오늘";
  if (d === 1) return "어제";
  if (d < 30) return `${d}일 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

export default async function WorkspacePage() {
  const viewer = await getViewer();
  const supabase = await createClient();

  // RLS 가 본인 행만 통과시키므로 별도 필터가 필요 없다.
  const { data: runsRaw } = viewer.email
    ? await supabase
        .from("app_runs")
        .select("id, app_id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: null };
  const runs: Run[] = runsRaw ?? [];

  // 실행 이력에 등장한 앱들의 이름을 한 번에 받아 온다.
  const appIds = Array.from(new Set(runs.map((r) => r.app_id).filter(Boolean))) as string[];
  const { data: appRows } = appIds.length
    ? await supabase.from("apps").select("id, name, app_schema").in("id", appIds)
    : { data: null };

  const nameOf = new Map<string, string>();
  for (const row of appRows ?? []) {
    const meta = (row as any).app_schema?.meta ?? {};
    nameOf.set((row as any).id, meta.appName || (row as any).name || "이름 없는 앱");
  }

  const byApp = new Map<string, { name: string; count: number; last: string }>();
  for (const r of runs) {
    if (!r.app_id) continue;
    const cur = byApp.get(r.app_id);
    if (cur) cur.count += 1;
    else
      byApp.set(r.app_id, {
        name: nameOf.get(r.app_id) ?? "삭제된 앱",
        count: 1,
        last: r.created_at,
      });
  }
  const ranked = [...byApp.entries()].sort((a, b) => b[1].count - a[1].count);

  const last30 = runs.filter(
    (r) => Date.now() - new Date(r.created_at).getTime() < 30 * 86400000
  ).length;

  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="MY WORKSPACE"
      title="내가 돌린 앱이 쌓이는 곳."
      lead="실행한 앱의 이력과 사용 통계를 한곳에서 봅니다."
    >
      {!viewer.email ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--card-radius)] border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-6 py-5">
          <div>
            <p className="text-[13.5px] font-bold text-[var(--sec-heading)]">
              로그인하면 내 작업실을 볼 수 있습니다.
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--sec-muted)]">
              실행 이력은 계정에 귀속됩니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/login?next=/workspace"
              className="rounded-xl bg-[var(--accent)] px-5 py-3 text-[12.5px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-[var(--card-line)] bg-[var(--card-bg)] px-5 py-3 text-[12.5px] font-bold text-[var(--sec-heading)] transition hover:border-[var(--accent)]"
            >
              회원가입
            </Link>
          </div>
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-6 py-16 text-center">
          <p className="text-sm font-bold text-[var(--sec-heading)]">아직 실행한 앱이 없습니다.</p>
          <p className="mt-2 text-[13px] text-[var(--sec-muted)]">
            <Link href="/apps" className="font-bold text-[var(--accent)] underline">
              인사기능별 앱
            </Link>
            에서 필요한 업무를 골라 시작해 보세요.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {[
              { label: "누적 실행", value: runs.length, unit: "회" },
              { label: "최근 30일", value: last30, unit: "회" },
              { label: "사용한 앱", value: byApp.size, unit: "개" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6"
              >
                <p className="text-[11px] font-black tracking-[0.14em] text-[var(--sec-muted)]">
                  {s.label}
                </p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-[-0.04em] text-[var(--sec-heading)]">
                  {s.value}
                  <span className="ml-1 text-[15px] font-bold text-[var(--sec-muted)]">
                    {s.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <section className="mb-10">
            <h2 className="mb-4 text-[18px] font-bold tracking-[-0.03em] text-[var(--sec-heading)]">
              자주 쓴 앱
            </h2>
            <div className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)]">
              {ranked.map(([id, a], i) => {
                const pct = Math.round((a.count / ranked[0][1].count) * 100);
                return (
                  <Link
                    key={id}
                    href={`/apps/${id}`}
                    className="flex items-center gap-4 border-b border-[var(--sec-line)] px-6 py-4 transition last:border-b-0 hover:bg-[var(--accent-soft)]"
                  >
                    <span className="w-5 shrink-0 text-[12px] font-black text-[var(--sec-muted)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-[var(--sec-heading)]">
                        {a.name}
                      </span>
                      <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--sec-line)]">
                        <span
                          className="block h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-bold text-[var(--sec-heading)]">
                        {a.count}회
                      </span>
                      <span className="block text-[11px] text-[var(--sec-muted)]">
                        {relDays(a.last)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-[18px] font-bold tracking-[-0.03em] text-[var(--sec-heading)]">
              최근 실행 이력
            </h2>
            <div className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)]">
              {runs.slice(0, 20).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--sec-line)] px-6 py-3.5 last:border-b-0"
                >
                  <span className="w-[132px] shrink-0 text-[12px] tabular-nums text-[var(--sec-muted)]">
                    {fmtDate(r.created_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--sec-heading)]">
                    {r.app_id ? (nameOf.get(r.app_id) ?? "삭제된 앱") : "—"}
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--accent)]">
                    리포트 조회
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-[var(--sec-muted)]">
              생성된 문서는 서버에 보관하지 않습니다. 결과가 다시 필요하면 앱을 열어 내려받으세요.
            </p>
          </section>
        </>
      )}

      <h2 className="mb-4 mt-2 text-[18px] font-bold tracking-[-0.03em] text-[var(--sec-heading)]">
        준비 중
      </h2>
      <PlannedList
        items={[
          { id: "bundles", title: "마이 앱 번들", desc: "채용·평가 시즌 등 목적별 앱 그룹화 폴더" },
          {
            id: "archive",
            title: "산출물 보관함",
            desc: "생성된 리포트 재다운로드 — 인사 민감정보 보관 정책 확정 후 제공합니다",
          },
          { id: "billing", title: "결제 내역·영수증", desc: "세금계산서 발행 및 결제 히스토리 조회" },
        ]}
      />
    </SectionShell>
  );
}
