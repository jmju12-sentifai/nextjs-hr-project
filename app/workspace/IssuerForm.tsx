"use client";
import { useState } from "react";
import type { ReportIssuer } from "app-renderer";
import { saveIssuer } from "./actions";

/**
 * 리포트 발행 정보 — 문서형 리포트의 머리말(회사명)과 꼬리말(담당 부서·문의처)에 들어간다.
 * 계정마다 한 번 입력해 두고 모든 앱 리포트에 쓴다. 비어 있는 칸은 리포트에서 그 줄을 뺀다.
 * 별도 테이블 없이 auth 사용자 메타데이터(report_issuer)에 둔다 — 저장은 서버 액션.
 */
const FIELDS: { key: keyof ReportIssuer; label: string; placeholder: string }[] = [
  { key: "company", label: "회사명", placeholder: "예: 온누리테크" },
  { key: "dept", label: "담당 부서", placeholder: "예: 인사팀 보상 담당" },
  { key: "contact", label: "문의처", placeholder: "예: 02-1234-5678 / hr@example.com" },
];

export default function IssuerForm({ initial }: { initial: ReportIssuer | null }) {
  const [v, setV] = useState<ReportIssuer>({
    company: initial?.company ?? "",
    dept: initial?.dept ?? "",
    contact: initial?.contact ?? "",
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    setErr("");
    const { error } = await saveIssuer(v);
    if (error) {
      setState("error");
      setErr(error);
      return;
    }
    setState("saved");
  };

  return (
    <form
      onSubmit={save}
      className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} htmlFor={`issuer-${f.key}`} className="block min-w-0">
            <span className="mb-1.5 block text-[12px] font-bold text-[var(--sec-heading)]">{f.label}</span>
            <input
              id={`issuer-${f.key}`}
              value={v[f.key] ?? ""}
              onChange={(e) => {
                setV({ ...v, [f.key]: e.target.value });
                if (state !== "saving") setState("idle");
              }}
              placeholder={f.placeholder}
              maxLength={80}
              className="w-full rounded-lg border border-[var(--card-line)] bg-[var(--card-bg)] px-3 py-2 text-[13px] text-[var(--sec-heading)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-[12px] text-[var(--sec-muted)]">
          {state === "saved"
            ? "저장했습니다. 다음에 여는 리포트부터 반영됩니다."
            : state === "error"
              ? `저장하지 못했습니다. ${err}`
              : "회사명은 머리말에, 담당 부서와 문의처는 꼬리말에 들어갑니다. 비워 두면 그 줄을 뺍니다."}
        </span>
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-[12.5px] font-bold text-[var(--accent-on)] transition hover:opacity-90 disabled:opacity-50"
        >
          {state === "saving" ? "저장 중" : "저장"}
        </button>
      </div>
    </form>
  );
}
