"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitAppRequest } from "../actions/board";
import { Field, inputCls } from "../components/home/Field";
import { HR_CATEGORIES } from "@/lib/catalog";

/**
 * 엑셀 6번 "신규 개발 요청 폼 — PSST 논리 구조 차용".
 * 항목 정의가 문서에 없어 인사 앱 맥락으로 네 칸을 잡았다:
 *   Problem 어떤 업무가 문제인가 / Solution 어떤 산출물이면 해결되나
 *   Skill 지금은 어떻게 처리하나 / Transfer 누가 얼마나 자주 쓰나
 */
export default function RequestForm({ canWrite }: { canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (!canWrite) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--sec-bg-alt)] px-6 py-5">
        <p className="text-[13px] text-[var(--sec-muted)]">
          로그인하면 필요한 앱을 직접 요청하고 투표할 수 있습니다.
        </p>
        <Link
          href="/login?next=/requests"
          className="rounded-xl bg-[var(--accent)] px-5 py-3 text-[12.5px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
        >
          로그인
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-[var(--card-radius)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-6 py-6 text-center">
        <p className="text-[14px] font-bold text-[var(--sec-heading)]">요청이 접수되었습니다.</p>
        <p className="mt-1.5 text-[12.5px] text-[var(--sec-muted)]">
          검토 후 아래 목록에서 진행 상태를 확인하실 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setOpen(false);
          }}
          className="mt-4 text-[12.5px] font-bold text-[var(--accent)] underline"
        >
          다른 요청 남기기
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[var(--card-radius)] border border-dashed border-[var(--accent)]/40 bg-[var(--accent-soft)] px-6 py-6 text-[14px] font-bold text-[var(--accent)] transition hover:opacity-85"
      >
        + 필요한 앱 요청하기
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await submitAppRequest(fd);
          if (r.ok) {
            setDone(true);
            setMsg(null);
          } else setMsg(r.message);
        })
      }
      className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6 shadow-[var(--card-shadow)]"
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-[var(--sec-heading)]">앱 개발 요청</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-bold text-[var(--sec-muted)] hover:text-[var(--accent)]"
        >
          닫기
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="제목" required>
            <input name="title" required maxLength={120} className={inputCls}
              placeholder="예: 육아휴직 복직자 처우 재산정" />
          </Field>
        </div>
        <Field label="인사기능 영역">
          <select name="category" className={inputCls} defaultValue="">
            <option value="">선택 안 함</option>
            {HR_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="누가 얼마나 자주 쓰나" hint="Transfer">
          <input name="usage_note" className={inputCls} placeholder="예: 인사팀 3명 · 분기 1회" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="어떤 업무가 문제인가" hint="Problem" required>
            <textarea name="problem" required rows={3} className={inputCls}
              placeholder="지금 어떤 점이 번거롭거나 오류가 나는지 적어주세요." />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="어떤 산출물이 나오면 해결되나" hint="Solution" required>
            <textarea name="solution" required rows={3} className={inputCls}
              placeholder="예: 대상자 목록과 산정 근거가 담긴 검토 리포트" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="지금은 어떻게 처리하나 · 소요 시간" hint="Skill">
            <textarea name="current_way" rows={2} className={inputCls}
              placeholder="예: 엑셀로 수작업, 건당 30분" />
          </Field>
        </div>
      </div>

      {msg && (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-[12.5px] font-bold text-rose-700">
          {msg}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "등록 중…" : "요청 등록"}
      </button>
    </form>
  );
}
