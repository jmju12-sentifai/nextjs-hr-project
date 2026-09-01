"use client";

import { useState, useTransition } from "react";
import { submitInquiry } from "../actions/board";
import { Field, inputCls } from "../components/home/Field";

const KINDS = [
  { key: "support", label: "1:1 문의", hint: "사용 중 막힌 부분" },
  { key: "voc", label: "VOC · 에러 리포트", hint: "UI 버그, 결과 오류" },
  { key: "partnership", label: "B2B 제휴 제안", hint: "파트너십 · 앱 입점" },
] as const;

export default function InquiryForm({ defaultEmail }: { defaultEmail?: string | null }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("support");
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="rounded-[var(--card-radius)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-6 py-8 text-center">
        <p className="text-[14px] font-bold text-[var(--sec-heading)]">접수되었습니다.</p>
        <p className="mt-1.5 text-[12.5px] text-[var(--sec-muted)]">
          남겨주신 이메일로 회신드리겠습니다.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-4 text-[12.5px] font-bold text-[var(--accent)] underline"
        >
          다른 문의 남기기
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await submitInquiry(fd);
          if (r.ok) {
            setDone(true);
            setMsg(null);
          } else setMsg(r.message);
        })
      }
      className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6 shadow-[var(--card-shadow)]"
    >
      <input type="hidden" name="kind" value={kind} />

      <div className="mb-6 flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const on = k.key === kind;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              aria-pressed={on}
              className={`rounded-[var(--chip-radius)] border px-4 py-2.5 text-left transition ${
                on
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
                  : "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)]"
              }`}
            >
              <span className="block text-[12.5px] font-bold">{k.label}</span>
              <span className={`block text-[10.5px] ${on ? "opacity-70" : "text-[var(--sec-muted)]"}`}>
                {k.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름">
          <input name="name" maxLength={60} className={inputCls} placeholder="홍길동" />
        </Field>
        <Field label="이메일" required>
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultEmail ?? ""}
            className={inputCls}
            placeholder="name@company.com"
          />
        </Field>
        {kind === "partnership" && (
          <div className="sm:col-span-2">
            <Field label="회사 · 기관명">
              <input name="company" maxLength={120} className={inputCls} />
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="제목" required>
            <input name="subject" required maxLength={200} className={inputCls} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="내용"
            required
            hint={
              kind === "voc"
                ? "어떤 앱에서 어떤 입력으로 어떤 결과가 나왔는지 적어주시면 확인이 빠릅니다"
                : undefined
            }
          >
            <textarea name="body" required rows={6} className={inputCls} />
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
        {pending ? "보내는 중…" : "보내기"}
      </button>
      <p className="mt-3 text-center text-[11.5px] text-[var(--sec-muted)]">
        급하시면 010.9041.9930 · besthrcoach@naver.com
      </p>
    </form>
  );
}
