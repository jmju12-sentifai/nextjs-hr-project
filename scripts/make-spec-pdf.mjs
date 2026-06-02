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
const outDir = path.join(__dirname, "..", "samples");

Font.register({
  family: "NotoKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
      fontWeight: 400,
    },
  ],
});

const S = StyleSheet.create({
  page: {
    padding: 44,
    fontFamily: "NotoKR",
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#1f2937",
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 11, color: "#6b7280", marginBottom: 18 },
  h2: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    color: "#1d4ed8",
  },
  h3: { fontSize: 11.5, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 130, color: "#4b5563" },
  value: { flex: 1 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  dot: { width: 12, color: "#1d4ed8" },
  table: {
    border: "1px solid #d1d5db",
    marginTop: 4,
    marginBottom: 6,
    borderRadius: 2,
  },
  tr: { flexDirection: "row", borderBottom: "1px solid #e5e7eb" },
  th: {
    padding: 5,
    backgroundColor: "#f3f4f6",
    fontWeight: 700,
    fontSize: 9.5,
  },
  td: { padding: 5, fontSize: 10 },
  note: {
    backgroundColor: "#eff6ff",
    padding: 8,
    borderRadius: 3,
    marginTop: 6,
    fontSize: 10,
    color: "#1e3a8a",
  },
});

const Bullet = ({ children }) =>
  React.createElement(View, { style: S.bullet }, [
    React.createElement(Text, { style: S.dot, key: "d" }, "•"),
    React.createElement(Text, { style: { flex: 1 }, key: "t" }, children),
  ]);

const Row = (k, v) =>
  React.createElement(View, { style: S.row }, [
    React.createElement(Text, { style: S.label, key: "k" }, k),
    React.createElement(Text, { style: S.value, key: "v" }, v),
  ]);

// 표 생성
const Table = (cols, rows) => {
  const widths = cols.map((c) => c.w || 1);
  const total = widths.reduce((a, b) => a + b, 0);
  const head = React.createElement(View, { style: S.tr, key: "h" },
    cols.map((c, i) =>
      React.createElement(Text, {
        key: i,
        style: [S.th, { flex: widths[i] / total }],
      }, c.label)
    )
  );
  const body = rows.map((r, ri) =>
    React.createElement(View, { style: S.tr, key: ri },
      r.map((cell, ci) =>
        React.createElement(Text, {
          key: ci,
          style: [S.td, { flex: widths[ci] / total }],
        }, String(cell))
      )
    )
  );
  return React.createElement(View, { style: S.table }, [head, ...body]);
};

// ─────────────────────── 기획서 본문 ───────────────────────

const Spec = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: "A4", style: S.page },

    React.createElement(Text, { style: S.title }, "퇴직금 자동 산정 마이크로 SaaS 앱 기획서"),
    React.createElement(Text, { style: S.sub }, "버전 1.0 · 작성: HR 운영팀 · 2026"),

    // ─── ⓪ 앱 개요 ───
    React.createElement(Text, { style: S.h2 }, "⓪ 앱 개요"),
    Row("앱명 / 타이틀", "퇴직금 자동 산정 마이크로 SaaS 앱"),
    Row("서비스 한줄 설명", "1명의 임직원 정보를 입력하면 사내 규정 기반으로 법정·약정 퇴직금을 자동 계산합니다."),
    React.createElement(Text, { style: S.h3 }, "구축 목적"),
    React.createElement(Text, { style: S.p },
      "법정 퇴직금과 사내 약정 가산금 산정 업무는 근속연수, 평균임금, 가산율 등 다수 변수의 정형 계산을 반복합니다. "
      + "본 앱은 인사 운영자가 직원 1명의 정보를 입력하면 사내 규정을 기준으로 즉시 퇴직금 명세를 산출하도록 합니다."),
    React.createElement(Text, { style: S.h3 }, "해결하려는 문제"),
    React.createElement(Text, { style: S.p },
      "엑셀 수작업 산정 시 평균임금 산정 오류, 가산율 적용 누락, 산정 결과 일관성 부족 문제가 빈번합니다."),
    React.createElement(Text, { style: S.h3 }, "대상 사용자"),
    React.createElement(Text, { style: S.p }, "HR 운영팀 · 보상 담당자 · 인사 노무 컨설턴트"),
    React.createElement(Text, { style: S.h3 }, "보안 / 클라우드 안내"),
    React.createElement(Text, { style: S.p }, "개인정보 보호 · 보안 암호화 · 처리 후 원본 즉시 폐기 · 클라우드 기반"),

    React.createElement(Text, { style: S.h3 }, "기대 효과"),
    Bullet("산정 업무 시간 80% 절감"),
    Bullet("규정 자동 적용으로 산정 오류 최소화"),
    Bullet("결과 안내서 자동 생성으로 직원 커뮤니케이션 표준화"),
    Bullet("규정 개정 시 빌더에서 즉시 반영"),

    React.createElement(Text, { style: S.h3 }, "핵심 특징"),
    Bullet("모듈형 산출 블록 (분기·분류·구간표·계산식·보정·날짜)"),
    Bullet("LLM 미사용 결정론 계산 — 동일 입력 동일 출력"),
    Bullet("PDF / DOCX / JSON 리포트 자동 생성")
  ),

  // ─── ① 규정 변수 ───
  React.createElement(
    Page,
    { size: "A4", style: S.page },
    React.createElement(Text, { style: S.h2 }, "① 규정 변수 (취업규칙 / 사내 인사규정에서 파싱)"),
    React.createElement(Text, { style: S.p },
      "사내 퇴직금 규정에서 추출할 기준 정책 상수입니다. 모든 값은 표시 전용 단위로 보관하며, "
      + "실제 계산은 원수치로 수행합니다."),
    Table(
      [
        { label: "변수명", w: 2 },
        { label: "타입", w: 1 },
        { label: "단위", w: 1 },
        { label: "예시 / 설명", w: 3 },
      ],
      [
        ["법정평균임금기간", "number", "일", "퇴직 직전 평균임금 산정 기준 일수 (예: 90)"],
        ["법정퇴직금일수", "number", "일", "근속 1년당 퇴직금 일수 (예: 30)"],
        ["가산적용근속년수", "number", "년", "약정 가산금이 적용되기 시작하는 근속연수"],
        ["가산율", "number", "%", "가산금 비율 (예: 0.1 = 10%)"],
        ["최저보장금액", "number", "원", "산정 결과가 이 이하면 보정"],
        ["기준일", "date", "", "퇴직금 산정 기준일 (보통 퇴직일)"],
        ["운영모델", "text", "", "사내 운영 모델명 (예: '표준형', '가산형')"],
      ]
    )
  ),

  // ─── ② 개인 변수 ───
  React.createElement(
    Page,
    { size: "A4", style: S.page },
    React.createElement(Text, { style: S.h2 }, "② 개인 변수 (개인 1명 문서에서 파싱)"),
    React.createElement(Text, { style: S.p },
      "퇴직금 산정 대상 임직원의 인적·임금 정보입니다. 필수 항목 누락 시 사용자 수기 보완 단계로 유도합니다."),
    Table(
      [
        { label: "변수명", w: 2 },
        { label: "타입", w: 1 },
        { label: "단위", w: 1 },
        { label: "필수", w: 0.6 },
        { label: "예시", w: 2.4 },
      ],
      [
        ["성명", "text", "", "필수", "홍길동"],
        ["사번", "text", "", "필수", "20142563"],
        ["입사일", "date", "", "필수", "2010-03-02"],
        ["퇴직일", "date", "", "필수", "2026-04-30"],
        ["월기본급", "number", "원", "필수", "5,500,000"],
        ["월직책수당", "number", "원", "선택", "300,000"],
        ["월식대보조", "number", "원", "선택", "150,000"],
        ["연간상여총액", "number", "원", "선택", "6,000,000"],
        ["연차수당", "number", "원", "선택", "1,200,000"],
        ["소속", "text", "", "선택", "재무팀"],
      ]
    )
  ),

  // ─── ③ 분석 로직 ───
  React.createElement(
    Page,
    { size: "A4", style: S.page },
    React.createElement(Text, { style: S.h2 }, "③ 분석 로직 (판정 → 산출)"),
    React.createElement(Text, { style: S.h3 }, "판정부 — 적용 대상 여부"),
    Bullet("[규정] 가산적용근속년수 ≤ [산출] 근속년수  → 가산금 적용 대상"),
    Bullet("근속년수가 가산 기준 미만이면 법정 퇴직금만 산정, 가산금은 미적용"),

    React.createElement(Text, { style: S.h3 }, "산출부 — 단계별 블록"),
    Table(
      [
        { label: "#", w: 0.4 },
        { label: "타입", w: 1 },
        { label: "이름(결과변수)", w: 1.5 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "날짜", "근속년수", "[입사일] 부터 [퇴직일] 까지 차이 (년 단위)"],
        ["2", "분류 (sum)", "월통상임금", "월기본급 + 월직책수당 + 월식대보조 (체크 항목 합계)"],
        ["3", "계산식", "일평균임금", "(월통상임금 × 3 + 연간상여총액 ÷ 4 + 연차수당 ÷ 4) ÷ 법정평균임금기간"],
        ["4", "계산식", "법정퇴직금", "일평균임금 × 법정퇴직금일수 × 근속년수"],
        ["5", "분기", "가산여부", "근속년수 ≥ 가산적용근속년수 → 참: '적용' / 거짓: '미적용'"],
        ["6", "계산식", "가산금", "법정퇴직금 × 가산율  (가산여부=='적용' 일 때만 의미)"],
        ["7", "계산식", "총퇴직금", "법정퇴직금 + 가산금"],
        ["8", "보정", "최종지급액", "[총퇴직금] 을 [최저보장금액] 이상으로 보정"],
      ]
    ),

    React.createElement(View, { style: S.note },
      React.createElement(Text, null,
        "주의: 모든 계산은 결정론적이며 LLM을 사용하지 않습니다. "
        + "단위(원/일/년/%)는 표시 전용이며 실제 계산은 원수치로 수행됩니다."
      )
    )
  ),

  // ─── ④ 리포트 구성 ───
  React.createElement(
    Page,
    { size: "A4", style: S.page },
    React.createElement(Text, { style: S.h2 }, "④ 리포트 구성 (사용자 안내서)"),
    React.createElement(Text, { style: S.p },
      "분석 결과를 사용자에게 보여줄 리포트의 구성입니다. 폭/높이 그리드는 빌더에서 조정합니다."),
    Table(
      [
        { label: "#", w: 0.4 },
        { label: "요소", w: 1.4 },
        { label: "라벨", w: 1.8 },
        { label: "바인딩", w: 1.6 },
        { label: "폭", w: 0.6 },
      ],
      [
        ["1", "기본정보", "성명", "성명", "⅓"],
        ["2", "기본정보", "사번", "사번", "⅓"],
        ["3", "기본정보", "소속", "소속", "⅓"],
        ["4", "요약카드", "근속년수", "근속년수", "⅓"],
        ["5", "요약카드", "일평균임금", "일평균임금", "⅓"],
        ["6", "요약카드", "최종지급액", "최종지급액", "⅓"],
        ["7", "판단근거 비교표", "가산금 적용 여부", "(자동)", "전체"],
        ["8", "산출근거 계산식", "법정퇴직금 산출", "법정퇴직금", "½"],
        ["9", "포함/제외 태그", "월통상임금 구성", "월통상임금", "½"],
        ["10", "안내문", "산정 결과 안내", "(템플릿)", "전체"],
      ]
    ),

    React.createElement(Text, { style: S.h3 }, "안내문 템플릿 예시"),
    React.createElement(Text, { style: S.p },
      "{성명}({사번}) 님의 근속년수는 {근속년수}년이며, 일평균임금은 {일평균임금}, "
      + "법정 퇴직금은 {법정퇴직금}, 가산금 {가산금} 를 포함한 최종 지급액은 {최종지급액}입니다."),

    React.createElement(Text, { style: S.h3 }, "변환·다운로드"),
    Bullet("PDF — 인쇄·아카이브용"),
    Bullet("DOCX — 사내 양식 결재 첨부용"),
    Bullet("JSON — 인사 시스템 연동용"),

    React.createElement(View, { style: S.note },
      React.createElement(Text, null,
        "본 기획서는 빌더의 AI 자동 채움 입력으로 사용되며, "
        + "5개 탭(앱개요·규정변수·개인변수·분석로직·리포트구성)을 채울 수 있도록 구조화되어 있습니다."
      )
    )
  )
);

await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, "spec-retirement.pdf");
await renderToFile(Spec, out);
console.log("✓", path.relative(process.cwd(), out));
