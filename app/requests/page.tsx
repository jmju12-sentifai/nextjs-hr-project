import { createClient } from "@/lib/supabase/server";
import SectionShell from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";
import { isMissingTable } from "@/lib/db-errors";
import RequestForm from "./RequestForm";
import VoteButton from "./VoteButton";

export const metadata = { title: "앱개발요청게시판 — HRcoach" };
export const dynamic = "force-dynamic";

/** 엑셀 6번 — 요청 폼 · 진행 상태 트래킹 · 유저 투표소 */
const STATUS: Record<string, { label: string; cls: string }> = {
  received: { label: "접수", cls: "bg-[var(--sec-line)] text-[var(--sec-muted)]" },
  reviewing: { label: "검토 중", cls: "bg-amber-100 text-amber-800" },
  building: { label: "개발 중", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" },
  done: { label: "완료", cls: "bg-emerald-100 text-emerald-800" },
  hold: { label: "보류", cls: "bg-[var(--sec-line)] text-[var(--sec-muted)]" },
};
const STATUS_ORDER = ["received", "reviewing", "building", "done", "hold"] as const;

type Row = {
  id: string;
  title: string;
  category: string | null;
  problem: string;
  solution: string;
  status: string;
  created_at: string;
  vote_count: number;
};

export default async function RequestsPage() {
  const viewer = await getViewer();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_requests_with_votes")
    .select("id, title, category, problem, solution, status, created_at, vote_count")
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const notReady = !!error && isMissingTable(error);
  const rows: Row[] = (data as Row[] | null) ?? [];

  // 내가 투표한 항목 — 버튼의 눌림 상태를 채운다
  const votedSet = new Set<string>();
  if (viewer.email && rows.length) {
    const { data: mine } = await supabase
      .from("app_request_votes")
      .select("request_id")
      .in(
        "request_id",
        rows.map((r) => r.id)
      );
    for (const v of mine ?? []) votedSet.add((v as any).request_id);
  }

  const counts = STATUS_ORDER.map((s) => ({
    key: s,
    label: STATUS[s].label,
    n: rows.filter((r) => r.status === s).length,
  }));

  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="REQUEST A NEW APP"
      title="필요한 인사 앱을 직접 요청하세요."
      lead="접수된 요청은 투표 수와 함께 공개됩니다. 많이 모인 요청부터 우선 개발합니다."
    >
      {notReady ? (
        <div className="rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-6 py-14 text-center">
          <p className="text-sm font-bold text-[var(--sec-heading)]">게시판 준비 중입니다.</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--sec-muted)]">
            급한 요청은 besthrcoach@naver.com 또는 010.9041.9930 으로 보내주세요.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <RequestForm canWrite={!!viewer.email} />
          </div>

          {rows.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {counts.map((c) => (
                <span
                  key={c.key}
                  className="flex items-center gap-2 rounded-[var(--chip-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] px-3.5 py-2 text-[12px] font-bold text-[var(--sec-heading)]"
                >
                  {c.label}
                  <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-black text-[var(--accent)]">
                    {c.n}
                  </span>
                </span>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-6 py-14 text-center">
              <p className="text-sm font-bold text-[var(--sec-heading)]">
                아직 등록된 요청이 없습니다.
              </p>
              <p className="mt-2 text-[13px] text-[var(--sec-muted)]">
                첫 요청을 남겨보세요. 다른 사용자의 투표로 우선순위가 올라갑니다.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => {
                const st = STATUS[r.status] ?? STATUS.received;
                return (
                  <li
                    key={r.id}
                    className="flex gap-5 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-5"
                  >
                    <VoteButton
                      requestId={r.id}
                      count={r.vote_count}
                      voted={votedSet.has(r.id)}
                      canVote={!!viewer.email}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${st.cls}`}
                        >
                          {st.label}
                        </span>
                        {r.category && (
                          <span className="text-[11px] font-bold text-[var(--sec-muted)]">
                            {r.category}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--sec-muted)]">
                          {r.created_at.slice(0, 10).replace(/-/g, ".")}
                        </span>
                      </div>
                      <h2 className="break-keep text-[15.5px] font-bold text-[var(--sec-heading)]">
                        {r.title}
                      </h2>
                      <p className="mt-1.5 line-clamp-2 break-keep text-[12.5px] leading-relaxed text-[var(--sec-muted)]">
                        {r.problem}
                      </p>
                      <p className="mt-2 break-keep text-[12.5px] leading-relaxed text-[var(--sec-heading)]">
                        <span className="mr-1.5 font-bold text-[var(--accent)]">원하는 산출물</span>
                        {r.solution}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </SectionShell>
  );
}
