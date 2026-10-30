import type { Path, ReportDoc, ReportIssuer } from "app-renderer";

// 임금피크제 샘플 앱(SAMPLE_WAGE_PEAK)의 가산형 경로에 붙이는 문서형 양식 예시.
// 'HR 산출 리포트 개선 제안'(2026-10-15) 3.1 안내서 구성을 시각화 블록 위주로 옮겼다.
// 조건 표시 이름은 경로의 조건 id 에 묶이므로 경로를 받아 만든다.
// 라벨에는 사람마다 달라지는 숫자를 적지 않는다 — 숫자는 언제나 {이름} 이나 bind 로.

let n = 0;
const id = () => `doc-${++n}`;

const UNITS = { 만나이: "세", 최초적용연령: "세", 정년: "세" };
const PATH_LABELS = { "peak-early": "가산형", "peak-standard": "표준형" };

/** 임직원 안내서 — 1쪽 결론·핵심 수치, 2쪽 산정 내역 */
export function wagePeakNoticeDoc(path: Path): ReportDoc {
  const [c1, c2] = path.conditions;
  return {
    title: "임금피크제 적용 안내",
    subjects: ["성명", "사번", "소속", "직급"],
    units: UNITS,
    blocks: [
      { id: id(), type: "headline", tpl: "{성명} 님은 {적용시점}부터 임금피크제(가산형)가 적용됩니다" },
      {
        id: id(),
        type: "kpis",
        items: [
          { label: "적용 후 월 기준액", bind: "최종월기준액" },
          { label: "감액률", bind: "감액률" },
          { label: "적용 시작", bind: "적용시점" },
          { label: "기준일 현재 만 나이", bind: "만나이" },
        ],
      },
      {
        id: id(),
        type: "formula",
        title: "이렇게 계산했습니다",
        bind: "적용후월기준액",
        labels: { 통상임금기준액: "통상임금 기준액", 감액률: "감액률", 적용후월기준액: "적용 후 월 기준액" },
        notes: {
          통상임금기준액: "기본급, 직책수당, 가족수당, 식대를 더한 금액입니다. 분기상여는 빠집니다.",
          감액률: "기준일 현재 만 나이가 속한 구간에 따라 운영 세칙에서 정한 비율입니다.",
        },
      },
      {
        id: id(),
        type: "compare",
        title: "감액 전과 후",
        items: [
          { label: "감액 전", bind: "통상임금기준액" },
          { label: "적용 후", bind: "최종월기준액" },
        ],
      },
      {
        id: id(),
        type: "text",
        title: "산정 근거",
        tpl: "기준일({기준일}) 현재 만 나이가 {만나이}로 최초 적용 연령({최초적용연령}) 이상이고 가산형 상한 이하에 해당합니다. 감액률과 통상임금 범위는 임금피크제 운영 세칙을 따릅니다.",
      },
      {
        id: id(),
        type: "text",
        locked: true,
        muted: true,
        tpl: "산정에 쓰인 인사 정보가 사실과 다르면 안내를 받은 날부터 14일 이내에 인사팀으로 정정을 요청해 주십시오. 정정된 정보로 다시 산정하여 안내합니다.",
      },
      { id: id(), type: "pagebreak" },
      {
        id: id(),
        type: "itemized",
        variant: "donut",
        title: "통상임금 구성",
        bind: "통상임금기준액",
        totalLabel: "통상임금 기준액",
        note: "분기상여는 정기·일률 지급 항목이 아니어서 통상임금 기준액에서 제외됩니다.",
      },
      {
        id: id(),
        type: "flow",
        variant: "waterfall",
        title: "월 기준액 산정 흐름",
        steps: [
          { label: "통상임금 기준액", bind: "통상임금기준액" },
          { label: "감액률 적용", bind: "적용후월기준액" },
          { label: "최저임금 하한 확인", bind: "최종월기준액" },
        ],
        endLabel: "최종 월 기준액",
      },
      {
        id: id(),
        type: "bandtable",
        title: "연령별 감액률",
        bind: "감액률",
        allPaths: true,
        pathLabels: PATH_LABELS,
        refLabel: "만 나이",
        valueLabel: "감액률",
        note: "감액률은 임금피크제 운영 세칙에 따릅니다.",
      },
      {
        id: id(),
        type: "bar",
        title: "최저임금 하한 대비 위치",
        bind: "최종월기준액",
        marks: [
          { label: "최저임금 하한", bind: "최저임금월액" },
          { label: "감액 전", bind: "통상임금기준액" },
        ],
      },
      {
        id: id(),
        type: "conditions",
        title: "적용 판단 근거",
        labels: {
          ...(c1 ? { [c1.id]: "최초 적용 연령 이상" } : {}),
          ...(c2 ? { [c2.id]: "가산형 상한 이하" } : {}),
        },
      },
    ],
  };
}

/** 표현 양식 견본 — 블록 종류와 표현 방식(variant)을 한 문서에 모아 본다 */
export function showcaseDoc(path: Path): ReportDoc {
  const chart = path.report.find((e) => e.kind === "chart" && e.ctype === "stacked");
  return {
    title: "표현 양식 견본",
    subjects: ["성명", "사번"],
    units: UNITS,
    blocks: [
      { id: id(), type: "headline", title: "결론 문장", tpl: "최종 월 기준액은 {최종월기준액}입니다" },
      {
        id: id(),
        type: "kpis",
        title: "핵심 수치 카드",
        items: [
          { label: "최종 월 기준액", bind: "최종월기준액" },
          { label: "감액률", bind: "감액률" },
          { label: "만 나이", bind: "만나이" },
        ],
      },
      {
        id: id(),
        type: "gauge",
        title: "비율 링",
        items: [
          { label: "감액률", bind: "감액률" },
          { label: "연차 사용률", bind: "연차사용", of: "연차부여" },
        ],
      },
      {
        id: id(),
        type: "compare",
        title: "전후 비교 막대",
        items: [
          { label: "전년 기본급", bind: "전년기본급" },
          { label: "올해 기본급", bind: "기본급" },
        ],
      },
      {
        id: id(),
        type: "formula",
        title: "산식 상자",
        bind: "적용후월기준액",
        labels: { 통상임금기준액: "통상임금 기준액", 적용후월기준액: "적용 후 월 기준액" },
      },
      {
        id: id(),
        type: "facts",
        title: "항목 값 목록",
        items: [
          { label: "적용 유형", bind: "적용여부" },
          { label: "적용 시작", bind: "적용시점" },
          { label: "기준일", bind: "기준일" },
          { label: "정년", bind: "정년" },
        ],
      },
      { id: id(), type: "pagebreak" },
      {
        id: id(),
        type: "itemized",
        variant: "bar",
        title: "명세서식 산정표 · 구성 막대",
        bind: "통상임금기준액",
        totalLabel: "통상임금 기준액",
        after: [{ label: "최종 월 기준액", bind: "최종월기준액" }],
      },
      {
        id: id(),
        type: "itemized",
        variant: "donut",
        title: "명세서식 산정표 · 도넛",
        bind: "통상임금기준액",
        totalLabel: "통상임금 기준액",
        hideExcluded: true,
      },
      {
        id: id(),
        type: "flow",
        variant: "waterfall",
        title: "단계별 산정 흐름 · 폭포 차트",
        steps: [
          { label: "통상임금 기준액", bind: "통상임금기준액" },
          { label: "감액률 적용", bind: "적용후월기준액" },
          { label: "최저임금 하한 확인", bind: "최종월기준액" },
        ],
        endLabel: "최종 월 기준액",
      },
      {
        id: id(),
        type: "flow",
        title: "단계별 산정 흐름 · 단계 목록",
        steps: [
          { label: "통상임금 기준액", bind: "통상임금기준액" },
          { label: "감액률", bind: "감액률" },
          { label: "적용 후 월 기준액", bind: "적용후월기준액" },
          { label: "최종 월 기준액", bind: "최종월기준액" },
        ],
      },
      { id: id(), type: "pagebreak" },
      {
        id: id(),
        type: "bandtable",
        title: "구간 일정표 · 막대",
        bind: "감액률",
        allPaths: true,
        pathLabels: PATH_LABELS,
        refLabel: "만 나이",
        valueLabel: "감액률",
      },
      {
        id: id(),
        type: "bandtable",
        variant: "table",
        title: "구간 일정표 · 표",
        bind: "감액률",
        allPaths: true,
        pathLabels: PATH_LABELS,
        refLabel: "만 나이",
        valueLabel: "감액률",
      },
      {
        id: id(),
        type: "range",
        title: "범위 내 위치",
        bind: "최종월기준액",
        min: "최저임금월액",
        max: "목표월기준액",
      },
      {
        id: id(),
        type: "bar",
        title: "하한·목표 대비 막대",
        bind: "최종월기준액",
        marks: [
          { label: "하한", bind: "최저임금월액" },
          { label: "목표", bind: "목표월기준액" },
        ],
      },
      {
        id: id(),
        type: "timeline",
        title: "타임라인",
        points: [
          { label: "생년월일", bind: "생년월일" },
          { label: "기준일", bind: "기준일" },
          { label: "적용 시작", bind: "적용시점" },
        ],
      },
      {
        id: id(),
        type: "counts",
        title: "일수 칸",
        items: [
          { label: "부여", bind: "연차부여" },
          { label: "사용", bind: "연차사용" },
        ],
        total: "연차부여",
        used: "연차사용",
      },
      { id: id(), type: "conditions", title: "조건 근거표" },
      ...(chart ? [{ id: id(), type: "element" as const, title: "기존 차트 끼워 넣기 (누적 막대)", el: chart }] : []),
    ],
  };
}

/** 견본 화면에만 쓰는 가상의 발행 정보 */
export const SAMPLE_ISSUER: ReportIssuer = {
  company: "온누리테크",
  dept: "인사팀 보상 담당",
  contact: "02-1234-5678",
};
