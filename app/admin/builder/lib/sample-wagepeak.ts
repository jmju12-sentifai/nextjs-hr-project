import type { AppSchema } from "app-renderer";

const uid = () => Math.random().toString(36).slice(2, 7);

// 다중 경로 모델 — 만 56~58 가산형 / 만 59~정년 표준형 / 미적용 (fallback)
export const SAMPLE_WAGE_PEAK: AppSchema = {
  meta: {
    appName: "임금피크제 자동화 마이크로 SaaS 앱",
    tagline:
      "1명의 임직원 정보를 파싱하여 임금피크제 적용 여부와 수준, 시기 등을 도출하고 적용합니다.",
    purpose:
      "임금피크제 적용에 필요한 기준 정보와 개인 데이터를 자동 처리하여 적용 여부·시기·수준·산출·안내까지 전 과정을 자동화합니다.",
    problem:
      "규정 해석과 개인별 적용 판단을 수작업으로 하면 시간이 많이 들고 오류·일관성 문제가 큽니다.",
    users: "HR 운영팀 · 보상 담당자",
    security: "개인정보 보호 · 보안 암호화 · 클라우드 기반",
    effects: [
      "업무 시간 최대 90% 절감",
      "데이터 기반 자동 처리로 오류 최소화",
      "최신 법령·기준 반영으로 컴플라이언스 강화",
    ],
    features: [
      "모듈형 마이크로 SaaS — 단계 선택 사용",
      "닫힌 문법 결정론 계산(LLM 미사용)",
      "다수 경로 분기로 그룹별 산출·안내",
    ],
  },
  vars: [
    // 개인 기본
    { id: uid(), grp: "개인", name: "성명", type: "text", unit: "", req: true, test: "홍길동" },
    { id: uid(), grp: "개인", name: "사번", type: "text", unit: "", req: true, test: "20142563" },
    { id: uid(), grp: "개인", name: "소속", type: "text", unit: "", req: false, test: "렌탈사업부" },
    { id: uid(), grp: "개인", name: "직급", type: "text", unit: "", req: false, test: "부장" },
    { id: uid(), grp: "개인", name: "생년월일", type: "date", unit: "", req: true, test: "1967-03-26" },

    // 규정
    { id: uid(), grp: "규정", name: "운영모델", type: "text", unit: "", req: false, test: "혼합형" },
    { id: uid(), grp: "규정", name: "최초적용연령", type: "number", unit: "년", req: false, test: "56" },
    { id: uid(), grp: "규정", name: "정년", type: "number", unit: "년", req: false, test: "60" },
    { id: uid(), grp: "규정", name: "최저임금월액", type: "number", unit: "원", req: false, test: "2060000" },
    { id: uid(), grp: "규정", name: "기준일", type: "date", unit: "", req: false, test: "2025-07-01" },

    // 보상 — 통상임금 구성
    { id: uid(), grp: "개인", name: "기본급", type: "number", unit: "원", req: true, test: "5500000" },
    { id: uid(), grp: "개인", name: "직책수당", type: "number", unit: "원", req: true, test: "200000" },
    { id: uid(), grp: "개인", name: "가족수당", type: "number", unit: "원", req: false, test: "150000" },
    { id: uid(), grp: "개인", name: "식대", type: "number", unit: "원", req: false, test: "100000" },
    { id: uid(), grp: "개인", name: "분기상여", type: "number", unit: "원", req: false, test: "500000" },

    // 추가 보상·평가 — 신규 차트용
    { id: uid(), grp: "개인", name: "전년기본급", type: "number", unit: "원", req: false, test: "5300000" },
    { id: uid(), grp: "개인", name: "목표월기준액", type: "number", unit: "원", req: false, test: "5800000" },
    { id: uid(), grp: "개인", name: "평가점수", type: "number", unit: "점", req: false, test: "82" },
    { id: uid(), grp: "개인", name: "연차부여", type: "number", unit: "일", req: false, test: "20" },
    { id: uid(), grp: "개인", name: "연차사용", type: "number", unit: "일", req: false, test: "12" },
  ],

  // 공통 사전 계산 — 모든 경로에서 사용되는 만나이/출생월/평가점수정규
  shared: {
    steps: [
      {
        id: uid(),
        type: "date",
        name: "만나이",
        unit: "년",
        mode: "diff",
        a: "생년월일",
        b: "기준일",
        out: "year",
      },
      {
        id: uid(),
        type: "date",
        name: "출생월",
        unit: "월",
        mode: "part",
        a: "생년월일",
        out: "month",
      },
      {
        id: uid(),
        type: "clamp",
        name: "평가점수정규",
        unit: "점",
        ref: "평가점수",
        min: "0",
        max: "100",
      },
    ],
  },

  // 경로 — 위에서부터 first-match
  paths: [
    {
      id: "peak-early",
      label: "가산형 적용 (만 56~58)",
      conditions: [
        { id: uid(), a: "만나이", op: ">=", b: "최초적용연령" },
        { id: uid(), a: "만나이", op: "<=", b: "58", bMode: "val" },
      ],
      steps: [
        {
          id: uid(),
          type: "branch",
          name: "적용시점",
          unit: "",
          ref: "출생월",
          op: "<=",
          rhs: 6,
          then: "해당 연도 7월 1일",
          thenT: "text",
          thenTok: [],
          els: "다음 연도 1월 1일",
          elsT: "text",
          elsTok: [],
        },
        {
          id: uid(),
          type: "classify",
          name: "통상임금기준액",
          unit: "원",
          agg: "sum",
          items: [
            { ref: "기본급", inc: true },
            { ref: "직책수당", inc: true },
            { ref: "가족수당", inc: true },
            { ref: "식대", inc: true },
            { ref: "분기상여", inc: false },
          ],
        },
        {
          id: uid(),
          type: "table",
          name: "감액률",
          unit: "%",
          ref: "만나이",
          bands: [
            { from: 56, to: 57, v: 0 },
            { from: 58, to: 58, v: 0.2 },
          ],
        },
        {
          id: uid(),
          type: "formula",
          name: "적용후월기준액",
          unit: "원",
          tokens: [
            { t: "var", name: "통상임금기준액" },
            { t: "op", op: "*" },
            { t: "lp" },
            { t: "num", v: 1 },
            { t: "op", op: "-" },
            { t: "var", name: "감액률" },
            { t: "rp" },
          ],
        },
        {
          id: uid(),
          type: "clamp",
          name: "최종월기준액",
          unit: "원",
          ref: "적용후월기준액",
          min: "최저임금월액",
          max: "",
        },
        {
          id: uid(),
          type: "llm",
          name: "LLM분석",
          unit: "",
          items: [
            "만나이",
            "감액률",
            "통상임금기준액",
            "적용후월기준액",
            "최종월기준액",
            "평가점수",
            "목표월기준액",
          ],
          prompt: "",
          lastResult:
            "만 58세로 가산형 임금피크제가 적용되어 감액률 20%가 반영된 최종 월기준액 4,760,000원이 산정되었습니다.\n전년 대비 통상임금 구성은 안정적이며 평가점수 82점으로 목표 대비 82% 수준의 실적입니다.\n적용 시점 이후 변동 사항이 있으면 인사팀에 즉시 문의하시고 잔여 연차도 계획적으로 사용하세요.",
          lastAt: new Date().toISOString(),
        },
      ],
      report: [
        // 헤더 — 기본정보 묶음
        {
          id: uid(),
          kind: "fields",
          label: "",
          bind: "",
          binds: ["성명", "사번", "소속", "직급"],
          w: "full",
          h: 1,
        },
        { id: uid(), kind: "card", label: "만 나이", bind: "만나이", w: "third", h: 2 },

        // 핵심 KPI — 적용 시작·감액률
        { id: uid(), kind: "card", label: "적용 시작", bind: "적용시점", w: "third", h: 2 },
        { id: uid(), kind: "card", label: "감액률", bind: "감액률", w: "third", h: 2 },
        { id: uid(), kind: "card", label: "최종 월기준액", bind: "최종월기준액", w: "third", h: 2 },

        // 평가점수 게이지
        { id: uid(), kind: "chart", ctype: "gauge", label: "평가점수", bind: "평가점수정규", w: "third", h: 2 },
        // 목표 대비 실적 (bullet)
        { id: uid(), kind: "chart", ctype: "bullet", label: "목표 대비 실적", bind: "최종월기준액", bind2: "목표월기준액", w: "third", h: 2 },
        // 연차 소진율 (ratio)
        { id: uid(), kind: "chart", ctype: "ratio", label: "연차 소진율", bind: "연차사용", bind2: "연차부여", w: "third", h: 2 },

        // 변화량 — 기본급 인상
        { id: uid(), kind: "chart", ctype: "delta", label: "기본급 변화 (전년 대비)", bind: "기본급", bind2: "전년기본급", w: "half", h: 2 },
        // 원본 vs 적용 후 (이중 막대)
        { id: uid(), kind: "chart", ctype: "comparison", label: "통상임금 vs 적용 후", bind: "통상임금기준액", bind2: "적용후월기준액", w: "half", h: 2 },
        // 임금 구성 누적 (stacked)
        { id: uid(), kind: "chart", ctype: "stacked", label: "통상임금 구성", bind: "통상임금기준액", w: "full", h: 2 },

        // 감액률 구간 막대
        { id: uid(), kind: "chart", ctype: "bar", label: "감액률 구간표", bind: "감액률", w: "half", h: 2 },
        // 포함 / 제외
        { id: uid(), kind: "incexc", label: "통상임금 항목", bind: "통상임금기준액", w: "half", h: 2 },

        // 판단 근거
        { id: uid(), kind: "compare", label: "판단 근거 비교표", bind: "", w: "full", h: 2 },

        // 안내문 — LLM 분석 요약
        {
          id: uid(),
          kind: "note",
          label: "AI 분석 요약",
          bind: "",
          w: "full",
          h: 2,
          tpl: "{LLM분석}",
        },
      ],
    },

    {
      id: "peak-standard",
      label: "표준형 적용 (만 59~정년)",
      conditions: [
        { id: uid(), a: "만나이", op: ">=", b: "59", bMode: "val" },
        { id: uid(), a: "만나이", op: "<=", b: "정년" },
      ],
      steps: [
        {
          id: uid(),
          type: "branch",
          name: "적용시점",
          unit: "",
          ref: "출생월",
          op: "<=",
          rhs: 6,
          then: "해당 연도 7월 1일",
          thenT: "text",
          thenTok: [],
          els: "다음 연도 1월 1일",
          elsT: "text",
          elsTok: [],
        },
        {
          id: uid(),
          type: "classify",
          name: "통상임금기준액",
          unit: "원",
          agg: "sum",
          items: [
            { ref: "기본급", inc: true },
            { ref: "직책수당", inc: true },
            { ref: "가족수당", inc: true },
            { ref: "식대", inc: true },
            { ref: "분기상여", inc: false },
          ],
        },
        {
          id: uid(),
          type: "table",
          name: "감액률",
          unit: "%",
          ref: "만나이",
          bands: [
            { from: 59, to: 59, v: 0.3 },
            { from: 60, to: 65, v: 0.35 },
          ],
        },
        {
          id: uid(),
          type: "formula",
          name: "적용후월기준액",
          unit: "원",
          tokens: [
            { t: "var", name: "통상임금기준액" },
            { t: "op", op: "*" },
            { t: "lp" },
            { t: "num", v: 1 },
            { t: "op", op: "-" },
            { t: "var", name: "감액률" },
            { t: "rp" },
          ],
        },
        {
          id: uid(),
          type: "clamp",
          name: "최종월기준액",
          unit: "원",
          ref: "적용후월기준액",
          min: "최저임금월액",
          max: "",
        },
        {
          id: uid(),
          type: "llm",
          name: "LLM분석",
          unit: "",
          items: [
            "만나이",
            "감액률",
            "통상임금기준액",
            "적용후월기준액",
            "최종월기준액",
            "평가점수",
            "목표월기준액",
          ],
          prompt: "",
          lastResult:
            "만 60세로 표준형 임금피크제가 적용되어 감액률 35%가 반영된 최종 월기준액이 산정되었습니다.\n통상임금 구성과 평가점수는 안정적이며 목표 대비 실적도 양호한 수준으로 유지되고 있습니다.\n잔여 근속 기간 동안 연차·복지 혜택을 계획적으로 사용하고 변경 사항은 인사팀에 문의하세요.",
          lastAt: new Date().toISOString(),
        },
      ],
      report: [
        {
          id: uid(),
          kind: "fields",
          label: "",
          bind: "",
          binds: ["성명", "사번", "소속", "직급"],
          w: "full",
          h: 1,
        },
        { id: uid(), kind: "card", label: "만 나이", bind: "만나이", w: "third", h: 2 },

        { id: uid(), kind: "card", label: "적용 시작", bind: "적용시점", w: "third", h: 2 },
        { id: uid(), kind: "card", label: "감액률", bind: "감액률", w: "third", h: 2 },
        { id: uid(), kind: "card", label: "최종 월기준액", bind: "최종월기준액", w: "third", h: 2 },

        { id: uid(), kind: "chart", ctype: "gauge", label: "평가점수", bind: "평가점수정규", w: "third", h: 2 },
        { id: uid(), kind: "chart", ctype: "bullet", label: "목표 대비 실적", bind: "최종월기준액", bind2: "목표월기준액", w: "third", h: 2 },
        { id: uid(), kind: "chart", ctype: "ratio", label: "연차 소진율", bind: "연차사용", bind2: "연차부여", w: "third", h: 2 },

        { id: uid(), kind: "chart", ctype: "delta", label: "기본급 변화 (전년 대비)", bind: "기본급", bind2: "전년기본급", w: "half", h: 2 },
        { id: uid(), kind: "chart", ctype: "comparison", label: "통상임금 vs 적용 후", bind: "통상임금기준액", bind2: "적용후월기준액", w: "half", h: 2 },

        { id: uid(), kind: "chart", ctype: "stacked", label: "통상임금 구성", bind: "통상임금기준액", w: "full", h: 2 },
        { id: uid(), kind: "chart", ctype: "step", label: "감액률 계단선 (연령)", bind: "감액률", w: "full", h: 2 },

        { id: uid(), kind: "compare", label: "판단 근거 비교표", bind: "", w: "full", h: 2 },
        // 안내문 — LLM 분석 요약
        {
          id: uid(),
          kind: "note",
          label: "AI 분석 요약",
          bind: "",
          w: "full",
          h: 2,
          tpl: "{LLM분석}",
        },
      ],
    },
  ],

  fallback: {
    id: "fallback",
    label: "임금피크제 미적용",
    conditions: [],
    steps: [],
    report: [
      {
        id: uid(),
        kind: "fields",
        label: "",
        bind: "",
        binds: ["성명", "사번", "소속", "직급"],
        w: "full",
        h: 1,
      },
      { id: uid(), kind: "card", label: "만 나이", bind: "만나이", w: "third", h: 2 },

      // 미적용 대상도 평가/변화 정보는 보여줌
      { id: uid(), kind: "chart", ctype: "gauge", label: "평가점수", bind: "평가점수정규", w: "third", h: 2 },
      { id: uid(), kind: "chart", ctype: "delta", label: "기본급 변화 (전년 대비)", bind: "기본급", bind2: "전년기본급", w: "third", h: 2 },
      { id: uid(), kind: "chart", ctype: "ratio", label: "연차 소진율", bind: "연차사용", bind2: "연차부여", w: "third", h: 2 },

      { id: uid(), kind: "chart", ctype: "bullet", label: "기본급 vs 목표", bind: "기본급", bind2: "목표월기준액", w: "half", h: 2 },
      { id: uid(), kind: "chart", ctype: "comparison", label: "기본급 vs 전년 기본급", bind: "기본급", bind2: "전년기본급", w: "half", h: 2 },
    ],
  },
};
