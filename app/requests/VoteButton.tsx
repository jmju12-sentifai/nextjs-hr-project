"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleVote } from "../actions/board";

/** 유저 투표소 — 1인 1표, 다시 누르면 취소 */
export default function VoteButton({
  requestId,
  count,
  voted,
  canVote,
}: {
  requestId: string;
  count: number;
  voted: boolean;
  canVote: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title={canVote ? (voted ? "투표 취소" : "이 요청에 투표") : "로그인 후 투표할 수 있습니다"}
      onClick={() =>
        start(async () => {
          if (!canVote) {
            router.push("/login?next=/requests");
            return;
          }
          await toggleVote(requestId);
          router.refresh();
        })
      }
      className={`flex w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition disabled:opacity-50 ${
        voted
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
          : "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
    >
      <span aria-hidden className="text-[11px] leading-none">▲</span>
      <span className="text-[15px] font-bold leading-none tabular-nums">{count}</span>
    </button>
  );
}
