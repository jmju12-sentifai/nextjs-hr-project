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
            <div className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)]">
              {/* 게시판 머리행 — 좁은 화면에서는 감춘다 */}
              <div className="hidden items-center gap-4 border-b border-[var(--sec-line)] bg-[var(--sec-bg-alt)] px-5 py-3 text-[11px] font-black tracking-[0.1em] text-[var(--sec-muted)] md:flex">
                <span className="w-12 shrink-0 text-center">번호</span>
                <span className="w-[70px] shrink-0 text-center">상태</span>
                <span className="min-w-0 flex-1">제목</span>
                <span className="w-[130px] shrink-0">영역</span>
                <span className="w-[92px] shrink-0 text-center">등록일</span>
                <span className="w-[62px] shrink-0 text-center">투표</span>
              </div>

              {rows.map((r, i) => {
                const st = STATUS[r.status] ?? STATUS.received;
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--sec-line)] px-5 py-4 transition last:border-b-0 hover:bg-[var(--accent-soft)]/40 md:flex-nowrap"
                  >
                    <span className="w-12 shrink-0 text-center text-[12px] tabular-nums text-[var(--sec-muted)]">
                      {rows.length - i}
                    </span>
                    <span className="w-[70px] shrink-0 text-center">
                      <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-black ${st.cls}`}>
                        {st.label}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 basis-full md:basis-auto">
                      <span className="block truncate text-[14px] font-bold text-[var(--sec-heading)]">
                        {r.title}
                      </span>
                      <span className="mt-1 block truncate text-[12px] text-[var(--sec-muted)]">
                        {r.problem}
                      </span>
                      <span className="mt-1 block truncate text-[12px] text-[var(--sec-heading)]">
                        <span className="mr-1.5 font-bold text-[var(--accent)]">산출물</span>
                        {r.solution}
                      </span>
                    </span>
                    <span className="w-[130px] shrink-0 truncate text-[11.5px] text-[var(--sec-muted)]">
                      {r.category ?? "—"}
                    </span>
                    <span className="w-[92px] shrink-0 text-center text-[11.5px] tabular-nums text-[var(--sec-muted)]">
                      {r.created_at.slice(0, 10).replace(/-/g, ".")}
                    </span>
                    <span className="w-[62px] shrink-0">
                      <VoteButton
                        requestId={r.id}
                        count={r.vote_count}
                        voted={votedSet.has(r.id)}
                        canVote={!!viewer.email}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-[12px] text-[var(--sec-muted)]">
            작성자는 표시하지 않습니다. 목록은 누구나 볼 수 있고, 투표는 로그인 후 1인 1표입니다.
          </p>
        </>
      )}
    </SectionShell>
  );
}
