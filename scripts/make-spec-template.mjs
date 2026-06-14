// 범용 앱 기획서 양식 — 모든 인사 도메인에서 그대로 채워 쓸 수 있도록 설계
// public/samples/spec-template.pdf 로 출력
// 빌더 "📄 기획서 업로드 (AI 자동 채움)" 에 그대로 올려도 동작하고,
// 출력 후 손으로 채워서 다시 올려도 됨.
//
// 실행: node scripts/make-spec-template.mjs

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToFile,
  Font,
} from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "samples");

Font.register({
  family: "NotoKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
      fontWeight: 700,
    },
  ],
});

const COL = {
  ink: "#0f172a",
  sub: "#475569",
  mute: "#94a3b8",
  line: "#cbd5e1",
  blue: "#2563eb",
  blueBg: "#dbeafe",
  blueLight: "#eff6fe",
  blueHead: "#1d4ed8",
  rose: "#dc2626",
  amber: "#b45309",
  violet: "#7c3aed",
  ghost: "#94a3b8",
};

const S = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 36,
    fontFamily: "NotoKR",
    fontSize: 9,
    lineHeight: 1.4,
    color: COL.ink,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: COL.blue,
    textAlign: "center",
    marginBottom: 2,
  },
  topSub: {
    fontSize: 9,
    color: COL.sub,
    textAlign: "center",
    marginBottom: 6,
    paddingBottom: 8,
    borderBottom: `2px solid ${COL.blue}`,
  },
  intro: {
    backgroundColor: "#fef3c7",
    borderLeft: `2px solid ${COL.amber}`,
    padding: 6,
    fontSize: 8,
    color: COL.amber,
    borderRadius: 2,
    marginBottom: 8,
    lineHeight: 1.5,
  },
  secBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COL.blueBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 6,
  },
  secLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  secNum: {
    backgroundColor: COL.blue,
    color: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8.5,
    fontWeight: 700,
    borderRadius: 2,
  },
  secTitle: { fontSize: 11, fontWeight: 700, color: COL.blueHead },
  secMeta: { fontSize: 8, color: COL.sub },
  table: { marginBottom: 4 },
  trH: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tr: {
    flexDirection: "row",
    borderTop: `0.5px solid ${COL.line}`,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: { fontSize: 8.5, fontWeight: 700, color: COL.sub },
  td: { fontSize: 8.5, color: COL.ink },
  tdGhost: { fontSize: 8.5, color: COL.ghost },
  rowKv: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderTop: `0.5px solid ${COL.line}`,
  },
  rowKvLabel: { width: 100, color: COL.sub, fontSize: 8.5 },
  rowKvValue: { flex: 1, fontSize: 8.5, color: COL.ghost },
  miniBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: COL.blueLight,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 3,
  },
  miniLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: COL.blue,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  miniLabelFb: {
    fontSize: 8,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: COL.rose,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  miniTitle: { fontSize: 9.5, fontWeight: 700, marginLeft: 6 },
  miniCond: { fontSize: 8, color: COL.sub },
  hint: {
    fontSize: 7.5,
    color: COL.mute,
    marginTop: 2,
    marginBottom: 4,
    paddingLeft: 4,
  },
  note: {
    backgroundColor: "#fef3c7",
    borderLeft: `2px solid ${COL.amber}`,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 8,
    color: COL.amber,
    borderRadius: 2,
    marginTop: 6,
    lineHeight: 1.5,
  },
});

const h = React.createElement;

const SectionBar = (num, title, meta) =>
  h(View, { style: S.secBar }, [
    h(View, { style: S.secLeft, key: "l" }, [
      h(Text, { style: S.secNum, key: "n" }, num),
      h(Text, { style: S.secTitle, key: "t" }, " " + title),
    ]),
    meta ? h(Text, { style: S.secMeta, key: "m" }, meta) : null,
  ]);

const MiniBar = (label, title, cond, fb) =>
  h(View, { style: S.miniBar }, [
    h(View, { style: { flexDirection: "row", alignItems: "center" }, key: "l" }, [
      h(Text, { style: fb ? S.miniLabelFb : S.miniLabel, key: "lab" }, label),
      h(Text, { style: S.miniTitle, key: "t" }, title),
    ]),
    cond ? h(Text, { style: S.miniCond, key: "c" }, cond) : null,
  ]);

const Table = (cols, rows, ghostRows = false) => {
  const widths = cols.map((c) => c.w || 1);
  const total = widths.reduce((a, b) => a + b, 0);
  const head = h(
    View,
    { style: S.trH, key: "h" },
    cols.map((c, i) =>
      h(Text, { key: i, style: [S.th, { flex: widths[i] / total }] }, c.label)
    )
  );
  const body = rows.map((r, ri) =>
    h(
      View,
      { style: S.tr, key: ri },
      r.map((cell, ci) =>
        h(
          Text,
          {
            key: ci,
            style: [ghostRows ? S.tdGhost : S.td, { flex: widths[ci] / total }],
          },
          String(cell ?? "")
        )
      )
    )
  );
  return h(View, { style: S.table }, [head, ...body]);
};

const Kv = (rows) =>
  h(
    View,
    { style: { borderTop: `0.5px solid ${COL.line}`, marginBottom: 4 } },
    rows.map(([k, v], i) =>
      h(View, { style: S.rowKv, key: i }, [
        h(Text, { style: S.rowKvLabel, key: "k" }, k),
        h(Text, { style: S.rowKvValue, key: "v" }, v),
      ])
    )
  );

const Hint = (text) => h(Text, { style: S.hint }, "▸ " + text);

// ───────────── 문서 ─────────────

const Doc = h(
  Document,
  null,

  // ─── PAGE 1 — 사용 안내 + 1탭 + 2탭 ───
  h(
    Page,
    { size: "A4", style: S.page },

    h(Text, { style: S.topTitle }, "[ 인사 자동화 마이크로 SaaS 앱 기획서 양식 ]"),
    h(
      Text,
      { style: S.topSub },
      "다중 경로 (first-match) + LLM 요약 모델 · 범용 작성 템플릿"
    ),

    h(
      View,
      { style: S.intro },
      h(
        Text,
        null,
        "📌 이 양식은 어떤 인사 도메인(임금피크제·복리후생·평가·퇴직금·승진 등)에도 그대로 사용할 수 있는 범용 기획서 템플릿입니다.\n" +
          "각 항목의 '예시'를 보고 자신의 도메인에 맞게 채운 뒤, 빌더 '📄 기획서 업로드' 에 업로드하면 5탭이 자동으로 구성됩니다.\n" +
          "비어 있는 항목은 AI 가 합리적으로 보완하므로 핵심만 적어도 됩니다."
      )
    ),

    // 1탭 앱 개요
    SectionBar("1탭", "앱 개요", "MSaaS 설명 / 리포트 머리글"),
    Kv([
      ["앱 명", "예: ○○ 자동화 마이크로 SaaS 앱"],
      ["한 줄 설명", "예: 임직원 정보를 파싱하여 ○○ 적용 여부·금액·시기를 자동 산출"],
      [
        "구축 목적",
        "예: 수작업으로 처리하던 ○○ 업무를 자동화하여 시간·오류·일관성 문제를 해결",
      ],
      [
        "해결하려는 문제",
        "예: 규정 해석과 개인별 적용 판단을 수작업으로 처리할 때 발생하는 시간 손실·오류",
      ],
      ["대상 사용자", "예: HR 운영팀 · ○○ 담당자 · 보상 컨설턴트"],
      ["보안/클라우드", "예: 개인정보 보호 · 보안 암호화 · 클라우드 기반 · 처리 후 원본 즉시 폐기"],
      [
        "기대 효과",
        "예: 업무 시간 N% 절감 · 자동 처리로 오류 최소화 · 컴플라이언스 강화",
      ],
      [
        "핵심 특징",
        "예: 모듈형 마이크로 SaaS · 결정론 계산(LLM 미사용) · 다중 경로 분기 · 안내문 자동 생성",
      ],
      [
        "처리 흐름 4단계",
        "예: 1) 기준 파일 지식화 → 2) 개인 데이터 파싱 → 3) 적용 여부 판단 → 4) 결과 산출 및 안내자료 생성",
      ],
    ]),

    // 2탭 규정 변수
    SectionBar("2탭", "규정 변수", "취업규칙·사내 규정·기준 파일에서 파싱"),
    Hint("타입: number(숫자) / text(텍스트) / date(날짜). 단위: 원·년·월·일·% 등 표시 전용."),
    Table(
      [
        { label: "변수명", w: 2 },
        { label: "타입", w: 1 },
        { label: "단위", w: 0.8 },
        { label: "예시값 / 설명", w: 3 },
      ],
      [
        ["[기준액1]", "number", "원", "예: 1,000,000 (정책 기준 금액)"],
        ["[기준률]", "number", "%", "예: 20 (감액률·지원율 등)"],
        ["[최저보장액]", "number", "원", "예: 2,060,000 (산정 결과 보정용)"],
        ["[적용연령]", "number", "년", "예: 56 (특정 조건 분기 기준)"],
        ["[기준일]", "date", "—", "예: 2026-07-01 (산정 기준일)"],
        ["[운영모델]", "text", "—", "예: 혼합형 / 표준형 / 가산형 등"],
      ],
      true
    ),

    // 3탭 개인 변수
    SectionBar("3탭", "개인 변수", "신청서·인사정보·증빙자료에서 파싱"),
    Hint("필수: 누락 시 사용자 수기 보완 단계로 유도. 선택: 비어 있어도 진행 가능."),
    Table(
      [
        { label: "변수명", w: 2 },
        { label: "타입", w: 1.2 },
        { label: "단위", w: 0.8 },
        { label: "필수", w: 0.6 },
        { label: "예시값", w: 2 },
      ],
      [
        ["성명", "text", "—", "필수", "홍길동"],
        ["사번", "text", "—", "필수", "20200123"],
        ["부서", "text", "—", "선택", "○○본부"],
        ["직급", "text", "—", "선택", "과장"],
        ["입사일", "date", "—", "필수", "2018-03-02"],
        ["[도메인 핵심 분류]", "text", "—", "필수", "예: 경조분류·교육유형 등"],
        ["[관계/대상]", "text", "—", "선택", "예: 본인·배우자·자녀"],
        ["[발생일]", "date", "—", "필수", "예: 2026-05-10"],
        ["[금액1]", "number", "원", "필수", "예: 5,500,000"],
        ["[수치1]", "number", "—", "선택", "예: 평가점수 82"],
      ],
      true
    )
  ),

  // ─── PAGE 2 — 분석 로직 ───
  h(
    Page,
    { size: "A4", style: S.page },

    SectionBar(
      "4탭",
      "분석 로직 — 공통 사전 계산 + 다중 경로 (first-match) + LLM 요약"
    ),

    h(
      Text,
      { style: S.hint },
      "▸ '공통 사전 계산'은 모든 경로가 공유하는 산출(예: 만나이, 경과일수). '경로'는 조건에 따라 갈리는 분기. 'Fallback'은 어느 경로도 해당 안 될 때."
    ),

    MiniBar("공통", "▤ 공통 사전 계산 (모든 경로 진입 전 실행)"),
    Table(
      [
        { label: "#", w: 0.3 },
        { label: "타입", w: 1.1 },
        { label: "결과변수", w: 1.5 },
        { label: "단위", w: 0.6 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "날짜(diff)", "[만나이]", "년", "예: [생년월일] → [기준일] 차이"],
        ["2", "날짜(diff)", "[경과일수]", "일", "예: [발생일] → [신청일] 차이"],
        ["3", "구간 보정(clamp)", "[정규화수치]", "—", "예: [평가점수] 0~100 보정"],
      ],
      true
    ),
    Hint(
      "타입 가이드 — date(diff/part): 날짜 계산, classify(sum/count/avg): 분류 합계, table: 구간표, formula: 계산식, clamp: 상하한 보정, branch: 조건 분기, llm: LLM 요약"
    ),

    MiniBar(
      "경로 1",
      "[경로 1 라벨 — 예: 적용 대상]",
      "조건: [변수1] [>=,<=,==] [값/변수], [변수2] ... (AND)"
    ),
    Table(
      [
        { label: "#", w: 0.3 },
        { label: "타입", w: 1.1 },
        { label: "결과변수", w: 1.5 },
        { label: "단위", w: 0.6 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "분기(branch)", "[중간변수1]", "—", "예: [조건] 참 → A / 거짓 → B"],
        ["2", "분류(sum)", "[집계금액]", "원", "예: [기본급] + [수당] (체크 항목 합)"],
        ["3", "구간표(table)", "[적용률]", "%", "예: 구간별 차등 적용률"],
        ["4", "계산식(formula)", "[1차결과]", "원", "예: [집계금액] × [적용률]"],
        ["5", "구간 보정(clamp)", "[최종금액]", "원", "예: [최저보장액] 이상으로 보정"],
        [
          "6",
          "LLM 요약(llm)",
          "[LLM분석]",
          "—",
          "예: 위 결과를 종합한 안내 메시지 자동 생성",
        ],
      ],
      true
    ),

    MiniBar(
      "경로 2",
      "[경로 2 라벨 — 예: 다른 그룹 적용]",
      "조건: [변수1] [...] AND [변수2] [...]"
    ),
    Table(
      [
        { label: "#", w: 0.3 },
        { label: "타입", w: 1.1 },
        { label: "결과변수", w: 1.5 },
        { label: "단위", w: 0.6 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "(경로 1과 다른 산식 구성)", "...", "...", "예: 다른 적용률·다른 집계 방식"],
        ["...", "...", "...", "...", "..."],
        ["N", "LLM 요약(llm)", "[LLM분석]", "—", "경로 2 전용 안내 메시지"],
      ],
      true
    ),
    Hint(
      "경로는 0~N개까지 자유. '위→아래 순서로 검사, 처음 매칭되는 경로 활성화 (first-match)'. 가장 좁은 조건을 위로."
    ),

    MiniBar(
      "Fallback",
      "▣ [미적용 / 대상 아님 라벨]",
      "조건 없음 — 어느 경로도 매칭 안 됐을 때",
      true
    ),
    h(
      Text,
      { style: { fontSize: 8.5, color: COL.sub, marginLeft: 2 } },
      "산출 블록 없음 — 안내문만 표시 (예: '○○ 적용 대상이 아닙니다')"
    )
  ),

  // ─── PAGE 3 — 5탭 리포트 + 가이드 ───
  h(
    Page,
    { size: "A4", style: S.page },

    SectionBar("5탭", "경로별 리포트 구성", "사용자에게 보여줄 안내서 카드 배치"),

    h(
      Text,
      { style: S.hint },
      "▸ 사이즈 표기 — WxH (가로 × 세로 그리드 칸). 텍스트 카드는 2x2, 차트는 3x2 이상 권장. 전체 폭은 6x2."
    ),

    MiniBar("경로 1", "[경로 1] — 리포트 카드 구성"),
    Table(
      [
        { label: "종류", w: 2 },
        { label: "바인딩", w: 2 },
        { label: "사이즈", w: 1 },
        { label: "설명", w: 3 },
      ],
      [
        ["fields (기본정보 묶음)", "성명·사번·부서·직급", "6x2", "한 카드에 변수 여러 개 묶음"],
        ["note (안내문)", "{LLM분석}", "6x2", "LLM 요약 결과 표시"],
        ["card (카드)", "[중간변수1]", "2x2", "큰 숫자 카드"],
        ["card", "[적용률]", "2x2", "—"],
        ["card", "[최종금액]", "2x2", "—"],
        ["chart (gauge)", "[정규화수치]", "3x2", "원형 진행 표시"],
        ["chart (bullet)", "[1차결과] vs [목표]", "3x2", "실적 vs 목표"],
        ["chart (delta)", "[금액1] vs [전년금액]", "3x2", "변화량"],
        ["chart (comparison)", "[집계금액] vs [최종금액]", "3x2", "이중 막대"],
        ["chart (stacked)", "[집계금액]", "6x2", "분류 단계 합계 구성"],
        ["chart (bar/step)", "[적용률]", "6x2", "구간표 시각화"],
        ["incexc (태그)", "[집계금액]", "3x2", "포함/제외 항목"],
        ["compare (비교표)", "(자동)", "6x2", "판정 조건 비교"],
      ],
      true
    ),

    MiniBar("경로 2", "[경로 2] — 동일 구조로 자체 리포트 구성"),
    h(
      Text,
      { style: S.hint },
      "▸ 경로별 안내문(LLM 요약)은 달라야 의미가 있음. 같은 변수라도 경로마다 메시지 톤이 다르게."
    ),

    MiniBar("Fallback", "[미적용] — 간략 리포트", "", true),
    Table(
      [
        { label: "종류", w: 2 },
        { label: "바인딩", w: 2 },
        { label: "사이즈", w: 1 },
        { label: "설명", w: 3 },
      ],
      [
        ["fields", "성명·사번·부서·직급", "6x2", "기본 정보"],
        ["card", "[중간변수1]", "2x2", "참고 정보"],
        ["note", "미해당 사유 안내", "6x2", "왜 적용 안 됐는지 설명"],
      ],
      true
    ),

    h(
      View,
      { style: S.note },
      h(
        Text,
        null,
        "💡 작성 팁\n" +
          "• [대괄호] 부분만 자신의 도메인에 맞게 채우면 됩니다. 빈 항목은 AI 가 자동 보완합니다.\n" +
          '• 변수명은 공백 없이 짧게 (예: "최종금액", "관계가산율"). 한글/영문 모두 가능.\n' +
          "• 다중 경로가 필요 없으면 경로 1개 + Fallback 만 작성해도 됩니다.\n" +
          "• LLM 요약은 빌더에서 자동 실행되어 안내문에 자동으로 채워집니다.\n" +
          "• 처리 흐름 4단계는 반드시 4개로 작성 — 1) 기준 지식화 → 2) 데이터 파싱 → 3) 적용 판단 → 4) 결과 안내."
      )
    )
  )
);

await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, "spec-template.pdf");
await renderToFile(Doc, out);
console.log("✓", path.relative(process.cwd(), out));
