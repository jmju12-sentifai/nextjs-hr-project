/** 폼 입력 공통 스타일. 토큰만 참조해 시안 테마를 따라간다. */
export const inputCls =
  "w-full rounded-xl border border-[var(--card-line)] bg-[var(--card-bg)] px-4 py-3 text-[13.5px] text-[var(--sec-heading)] outline-none transition placeholder:text-[var(--sec-muted)] focus:border-[var(--accent)]";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline gap-2">
        <span className="text-[12.5px] font-bold text-[var(--sec-heading)]">
          {label}
          {required && <span className="ml-1 text-[var(--accent)]">*</span>}
        </span>
        {hint && <span className="text-[11.5px] text-[var(--sec-muted)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
