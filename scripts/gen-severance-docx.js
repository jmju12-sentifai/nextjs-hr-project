// 퇴직금 예상금액 안내 앱 — 기획서 초안 .docx 생성 (1회용)
// 실행: node scripts/gen-severance-docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, TableLayoutType, WidthType, BorderStyle,
} = require("docx");

const FONT = "맑은 고딕";
const H = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 170, after: 40 }, children: [new TextRun({ text, font: FONT, bold: true, size: 22, color: "1D4ED8" })] });
const Bold = (text, color) => new Paragraph({ spacing: { before: 60, after: 20 }, children: [new TextRun({ text, font: FONT, bold: true, size: 17, color })] });
const Note = (text) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text, font: FONT, italics: true, color: "6B7280", size: 15 })] });
const P = (text) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text, font: FONT, size: 16 })] });

const cell = (text, w, { bold = false, fill } = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: fill ? { fill } : undefined,
    margins: { top: 20, bottom: 20, left: 70, right: 70 },
    children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: String(text), font: FONT, bold, size: 15 })] })],
  });
const tbl = (rows, widths) =>
  new Table({
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" }, bottom: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" },
      left: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" }, right: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: "E6EAEF" }, insideVertical: { style: BorderStyle.SINGLE, size: 3, color: "E6EAEF" },
    },
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, children: r.map((cc, ci) => cell(cc, widths[ci], i === 0 ? { bold: true, fill: "EAF1FB" } : {})) })),
  });

const W2 = [2200, 6800];
const W_REG = [1300, 2900, 1100, 1100, 2600];
const W_PER = [1300, 2600, 1000, 850, 800, 2450];
const W_LOG = [500, 1500, 1800, 700, 4500];
const W_COND = [3600, 1500, 3900];
const W_RPTP = [2200, 5000, 1800];

const c = [];
c.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "퇴직금 예상금액 안내 앱 기획서", font: FONT, bold: true, size: 30, color: "1D4ED8" })] }));
c.push(Note("임직원의 근속·급여 정보를 입력하면 법정·약정 퇴직금 예상액을 자동 산출·안내합니다. · 초안 v0.1"));

// 1. 앱 개요
c.push(H("1. 앱 개요"));
c.push(tbl([
  ["항목", "내용"],
  ["앱 명", "퇴직금 예상금액 안내 앱"],
  ["한 줄 설명", "임직원 근속·급여 정보를 입력하면 법정·약정 퇴직금 예상액을 자동 산출·안내합니다."],
  ["구축 목적", "퇴직 예정자에게 예상 퇴직금을 즉시 안내하고, 수기 계산 오류와 반복 문의를 줄여 보상 업무를 자동화합니다."],
  ["해결하려는 문제", "평균임금·근속연수 계산을 엑셀로 수기 처리하면 산정 오류·형평성·문의 응대 부담이 큽니다."],
  ["대상 사용자", "HR 운영팀 · 보상 담당자 · 퇴직 예정 임직원"],
  ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반 · 처리 후 원본 즉시 폐기"],
  ["기대 효과", "산정 시간 80% 절감 · 산정 오류 최소화 · 퇴직금 문의 응대 감소 · 규정 개정 즉시 반영"],
  ["핵심 특징", "결정론 계산(LLM 미사용) · 퇴직유형별 가산 분기 · 개인별 안내문 자동 생성"],
  ["처리 흐름 4단계", "1) 퇴직금 규정·가산율 지식화 → 2) 임직원 근속·급여 파싱 → 3) 퇴직유형·근속 판단 → 4) 예상 퇴직금 산출·안내"],
], W2));

// 2. 규정 변수
c.push(H("2. 규정 변수"));
c.push(Note("회사 퇴직금 규정·취업규칙에서 추출하는 정책 상수. 사용자가 입력하지 않습니다."));
c.push(Bold("상위 묶음: 법정 기준"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "예시값"],
  ["—", "법정지급일수", "number", "일", "30"],
  ["—", "1년환산일수", "number", "일", "365"],
  ["—", "최소지급근속년수", "number", "년", "1"],
], W_REG));
c.push(Bold("상위 묶음: 퇴직유형별 가산율"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "예시값"],
  ["정년", "정년가산율", "number", "%", "20"],
  ["권고", "권고가산율", "number", "%", "10"],
  ["자발", "자발가산율", "number", "%", "0"],
], W_REG));
c.push(Note("법정퇴직금 = 1일평균임금 * 30일 * (근속일수 / 365). 약정 가산은 퇴직유형별 가산율로 분기."));

// 3. 개인 변수
c.push(H("3. 개인 변수"));
c.push(Note("임직원 1명마다 다른 값 — 인사정보·급여대장에서 파싱/입력."));
c.push(Bold("상위 묶음: 기본정보"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "필수", "예시값"],
  ["—", "성명", "text", "—", "필수", "홍길동"],
  ["—", "사번", "text", "—", "필수", "20180123"],
  ["—", "부서", "text", "—", "선택", "경영지원부"],
  ["—", "직급", "text", "—", "선택", "부장"],
  ["—", "입사일", "date", "—", "필수", "2018-03-02"],
], W_PER));
c.push(Bold("상위 묶음: 퇴직정보"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "필수", "예시값"],
  ["—", "퇴직유형 (분기축)", "text", "—", "필수", "정년퇴직"],
  ["—", "퇴직예정일", "date", "—", "필수", "2026-06-30"],
], W_PER));
c.push(Bold("상위 묶음: 평균임금 산정"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "필수", "예시값"],
  ["직전3개월", "직전3개월임금총액", "number", "원", "필수", "15000000"],
  ["직전3개월", "직전3개월일수", "number", "일", "필수", "92"],
], W_PER));
c.push(Bold("★ 분기축 변수: 퇴직유형 / 분류값: 정년퇴직 · 권고사직 · 자발퇴직", "B45309"));

// 4. 분석 로직
c.push(H("4. 분석 로직"));
c.push(Note("공통 사전 계산 → 퇴직유형별 경로(first-match) → Fallback. 1년 미만은 Fallback(미지급)."));
c.push(Note("산식(formula)은 더하기 + , 빼기 - , 곱하기 * , 나누기 / 와 괄호 ( ) 로만 표기합니다 (×·÷ 대신 *·/ 사용)."));
c.push(Bold("공통 사전 계산 (모든 경로 진입 전)"));
c.push(tbl([
  ["#", "타입", "결과변수", "단위", "내용"],
  ["1", "date(diff)", "근속일수", "일", "입사일 → 퇴직예정일 차이"],
  ["2", "date(diff)", "근속연수", "년", "입사일 → 퇴직예정일 차이"],
  ["3", "formula", "1일평균임금", "원", "직전3개월임금총액 / 직전3개월일수"],
  ["4", "formula", "법정퇴직금", "원", "1일평균임금 * 법정지급일수 * (근속일수 / 1년환산일수)"],
], W_LOG));

const pathBlock = (label, condNote, condRows, rows) => {
  c.push(Bold(label));
  c.push(Bold("진입조건 (AND)" + (condNote ? "  — " + condNote : "")));
  c.push(tbl([["변수", "연산자", "값/변수"], ...condRows], W_COND));
  c.push(Bold("산출"));
  c.push(tbl([["#", "타입", "결과변수", "단위", "내용"], ...rows], W_LOG));
};
pathBlock("경로 1 — 정년퇴직", "분류(==)와 숫자(>=) 조건을 AND 로", [
  ["퇴직유형", "==", "\"정년퇴직\""],
  ["근속연수", ">=", "최소지급근속년수"],
], [
  ["1", "formula", "가산금", "원", "법정퇴직금 * 정년가산율 / 100"],
  ["2", "formula", "예상퇴직금", "원", "법정퇴직금 + 가산금"],
  ["3", "llm", "LLM분석", "—", "정년퇴직 예상 퇴직금·산정 근거 안내"],
]);
pathBlock("경로 2 — 권고사직", "", [
  ["퇴직유형", "==", "\"권고사직\""],
  ["근속연수", ">=", "최소지급근속년수"],
], [
  ["1", "formula", "가산금", "원", "법정퇴직금 * 권고가산율 / 100"],
  ["2", "formula", "예상퇴직금", "원", "법정퇴직금 + 가산금"],
  ["3", "llm", "LLM분석", "—", "권고사직 예상 퇴직금·산정 근거 안내"],
]);
pathBlock("경로 3 — 자발퇴직", "", [
  ["퇴직유형", "==", "\"자발퇴직\""],
  ["근속연수", ">=", "최소지급근속년수"],
], [
  ["1", "formula", "예상퇴직금", "원", "법정퇴직금 (약정 가산 없음)"],
  ["2", "llm", "LLM분석", "—", "자발퇴직 예상 퇴직금·산정 근거 안내"],
]);
c.push(Bold("Fallback — 지급 대상 아님 (근속 1년 미만)"));
c.push(P("진입조건 없음 — 어느 경로도 매칭 안 됨(근속 1년 미만 등). 산출 없음 — \"근속 1년 미만으로 법정 퇴직금 지급 대상이 아닙니다\" 안내문만 표시."));

// 5. 리포트
c.push(H("5. 경로별 리포트 구성"));
c.push(Note("사이즈 = WxH(전체 폭 6). 배치 순서: fields → note → 나머지."));
const reportTable = (label, rows) => {
  c.push(Bold(label));
  c.push(tbl([["종류", "바인딩", "사이즈"], ...rows], W_RPTP));
};
reportTable("경로 1 — 정년퇴직 리포트", [
  ["fields", "성명 · 사번 · 부서 · 직급", "6x1"],
  ["note", "{LLM분석}", "6x2"],
  ["card", "예상퇴직금", "2x2"],
  ["card", "근속연수", "2x2"],
  ["card", "1일평균임금", "2x2"],
  ["chart(comparison)", "법정퇴직금 vs 예상퇴직금", "3x2"],
  ["compare", "산정 근거 비교표", "6x2"],
]);
reportTable("경로 2 — 권고사직 리포트", [
  ["fields", "성명 · 사번 · 부서 · 직급", "6x1"],
  ["note", "{LLM분석}", "6x2"],
  ["card", "예상퇴직금", "2x2"],
  ["chart(comparison)", "법정퇴직금 vs 예상퇴직금", "3x2"],
]);
reportTable("경로 3 — 자발퇴직 리포트", [
  ["fields", "성명 · 사번 · 부서 · 직급", "6x1"],
  ["note", "{LLM분석}", "6x2"],
  ["card", "예상퇴직금", "2x2"],
  ["card", "근속연수", "2x2"],
]);
reportTable("Fallback — 지급 대상 아님 리포트", [
  ["fields", "성명 · 사번 · 부서 · 직급", "6x1"],
  ["note", "근속 1년 미만으로 법정 퇴직금 지급 대상이 아닙니다. 근속·입사일을 확인해 주세요.", "6x2"],
]);

const doc = new Document({
  sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: c }],
});
const out = path.join(process.cwd(), "public/samples/퇴직금_예상금액_기획서2.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("생성됨:", out, `(${buf.length} bytes)`);
});
