/**
 * 엑셀 1번 "시각화 튜토리얼 — 앱 조합 및 결과물 도출 과정 인포그래픽 가이드".
 * 비고에 "단순 표 지양, 시각 자료 중심" 이라 적혀 있어 표 대신 흐름도로 그렸다.
 *
 * ⚠️ 확정 인포그래픽 원본을 받으면 이 컴포넌트를 교체하면 된다.
 * 4단계 이름은 실제 앱 스키마의 meta.flow 가 따르는 골격과 같다.
 */
const STEPS = [
  {
    n: "1",
    title: "기준 지식화",
    desc: "회사 규정·기준표를 올리면 판단에 쓸 수 있는 형태로 정리합니다.",
    input: "취업규칙 · 급여규정 · 기준표",
  },
  {
    n: "2",
    title: "자료 파싱",
    desc: "대상자 명단과 증빙에서 필요한 값만 뽑아냅니다.",
    input: "명단 · 이력서 · 증빙",
  },
  {
    n: "3",
    title: "적정성 판단",
    desc: "기준과 대상자 값을 대조해 해당 여부와 금액·등급을 산정합니다.",
    input: "기준 × 대상자",
  },
  {
    n: "4",
    title: "안내·이행",
    desc: "판단 근거가 함께 담긴 결과 문서를 만들어 내려받습니다.",
    input: "검토 리포트 · 안내문",
  },
];

export default function FlowDiagram() {
  return (
    <div>
      <ol className="grid gap-3 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.n} className="relative">
            <div className="h-full rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[13px] font-black text-[var(--accent-on)]">
                {s.n}
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-[var(--sec-heading)]">{s.title}</h3>
              <p className="mt-2 break-keep text-[12.5px] leading-relaxed text-[var(--sec-muted)]">
                {s.desc}
              </p>
              <p className="mt-4 border-t border-[var(--sec-line)] pt-3 text-[11px] font-bold text-[var(--accent)]">
                {s.input}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute -right-[11px] top-1/2 hidden -translate-y-1/2 text-[16px] text-[var(--sec-line)] md:block"
              >
                ▶
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--sec-bg-alt)] p-6">
        <p className="text-[12px] font-black tracking-[0.14em] text-[var(--accent)]">EXAMPLE</p>
        <p className="mt-3 break-keep text-[13.5px] leading-[1.9] text-[var(--sec-heading)]">
          <b>퇴직금 예상금액 산정</b>을 예로 들면 —{" "}
          <span className="text-[var(--sec-muted)]">
            퇴직금 산정 기준을 올리고(1), 대상자의 입사일·급여 이력을 파싱한 뒤(2), 계속근로기간과
            평균임금을 기준에 대조해 금액을 산정하고(3), 산정 근거가 함께 담긴 안내문을
            만들어냅니다(4).
          </span>
        </p>
      </div>
    </div>
  );
}
