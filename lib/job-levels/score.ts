// 18레벨 표의 모의 직무가치 점수.
//
// 왜 AI가 아니라 고정 계산인가
//   고객이 ChatGPT로 만든 결과는 실행할 때마다 계산 방식이 달라졌다(지시하지 않은 시간 가중합산이 끼어든 사례).
//   점수는 같은 레벨이면 언제나 같은 값이 나오도록 코드로만 계산한다. 문장을 고쳐도 점수는 바뀌지 않는다.
//
// 기준값의 근거
//   고객 샘플 엑셀 2개(렌즈 인허가 237문장, 렌즈 품질관리 269문장)의 '모의점수_산식내역' 시트는
//   O*NET 실측값이 아니라 레벨마다 일정하게 오르는 가정값에 영역별 소폭 보정(+0~3점)을 더한 것이었다.
//   두 파일의 요소값을 레벨별로 평균해 직선으로 맞추면 오차가 0.3점 이내라, 그 시작값·증가폭을 그대로 쓴다.
//   영역별 보정은 실행마다 달라지지 않도록 0으로 둔다(고객 회신 2026-11-11 기준).
//   Z는 샘플과 같이 레벨 구간별 고정값이다.
//
// 산식은 가이드 v4.1 그대로다.
//   I = .55 A_IM + .25 K_IM + .20 T_IM
//   D = .40 A_LV + .25 K_LV + .25 T_LV + .10 Z
//   S = .30 R + .30 P + .20 A + .20 E
//   V = .35 I + .35 D + .30 S

type Element = "A_IM" | "K_IM" | "T_IM" | "A_LV" | "K_LV" | "T_LV" | "R" | "P" | "A" | "E";

// [L1 값, 레벨당 증가폭]
const BASE: Record<Element, [number, number]> = {
  A_IM: [39.71, 3.471],
  K_IM: [35.02, 3.732],
  T_IM: [46.4, 3.067],
  A_LV: [21.9, 4.574],
  K_LV: [20.4, 4.675],
  T_LV: [23.87, 4.418],
  R: [32.65, 4.07],
  P: [28.38, 4.166],
  A: [12.68, 4.719],
  E: [35.44, 3.623],
};

function zFor(level: number): number {
  if (level <= 6) return 45;
  if (level <= 12) return 56;
  if (level <= 14) return 69;
  return 77;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const clip = (n: number) => Math.min(100, Math.max(0, n));

export type MockScore = {
  inputs: Record<Element | "Z", number>;
  I: number;
  D: number;
  S: number;
  V: number;
};

export function mockScore(level: number): MockScore {
  const v = {} as Record<Element, number>;
  (Object.keys(BASE) as Element[]).forEach((k) => {
    const [start, step] = BASE[k];
    v[k] = r1(clip(start + step * (level - 1)));
  });
  const Z = zFor(level);
  const I = 0.55 * v.A_IM + 0.25 * v.K_IM + 0.2 * v.T_IM;
  const D = 0.4 * v.A_LV + 0.25 * v.K_LV + 0.25 * v.T_LV + 0.1 * Z;
  const S = 0.3 * v.R + 0.3 * v.P + 0.2 * v.A + 0.2 * v.E;
  const V = 0.35 * I + 0.35 * D + 0.3 * S;
  return { inputs: { ...v, Z }, I: r1(I), D: r1(D), S: r1(S), V: r1(V) };
}

export function scoreLabel(level: number): string {
  return `(모의 ${mockScore(level).V.toFixed(1)}점)`;
}
