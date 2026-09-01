/**
 * 앱 카드의 4단계 처리 흐름.
 * 기존 홈이 쓰던 표기(1-2-3-4 번호 + 단계별 색 진행)를 그대로 되살린 것.
 * 값은 app_schema.meta.flow 이며, 앱 실행기의 f1~f4 탭과 같은 골격이다.
 */
const DOT = [
  "bg-sky-500 ring-sky-100",
  "bg-blue-500 ring-blue-100",
  "bg-indigo-500 ring-indigo-100",
  "bg-violet-500 ring-violet-100",
];

export default function FlowSteps({ flow }: { flow: string[] }) {
  const steps = flow.slice(0, 4);
  if (!steps.length) return null;
  return (
    <ol className="relative mt-3 space-y-2">
      <span
        aria-hidden
        className="absolute left-[9px] top-2.5 bottom-2.5 w-px bg-gradient-to-b from-sky-200 via-indigo-200 to-violet-200"
      />
      {steps.map((step, i) => (
        <li key={i} className="relative flex items-start gap-2.5">
          <span
            className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${DOT[i]} text-[10px] font-bold text-white ring-4`}
          >
            {i + 1}
          </span>
          <span className="flex-1 break-keep text-[11.5px] leading-snug text-[var(--sec-fg)]">
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}
