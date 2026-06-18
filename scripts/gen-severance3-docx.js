// 퇴직금 예상금액 기획서3 — 기획서_템플릿_수정3 형태 + 리포트 차트 (1회용)
// 실행: node scripts/gen-severance3-docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, TableLayoutType, WidthType, BorderStyle,
} = require("docx");

const FONT = "맑은 고딕";
const H = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 40 }, children: [new TextRun({ text: t, font: FONT, bold: true, size: 22, color: "1D4ED8" })] });
const Bold = (t, color) => new Paragraph({ spacing: { before: 60, after: 20 }, children: [new TextRun({ text: t, font: FONT, bold: true, size: 17, color })] });
const P = (t) => new Paragraph({ spacing: { after: 16 }, children: [new TextRun({ text: t, font: FONT, size: 16 })] });

const cell = (text, w, { bold = false, fill } = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: fill ? { fill } : undefined,
    margins: { top: 22, bottom: 22, left: 80, right: 80 },
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

const W_VAR = [2100, 1500, 900, 2900, 1600];
const W_LOG = [2300, 1000, 5700];
const W_RPT = [5600, 3400];
const W_APP = [2200, 6800];

const c = [];
c.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "퇴직금 예상금액 안내 앱 기획서", font: FONT, bold: true, size: 28, color: "1D4ED8" })] }));
c.push(Bold("작성 규칙 (꼭 지킬 것)"));
[
  "표 안에 글자로만 채우기 — 이미지·캡처·셀 합치기 금지(값이 깨집니다).",
  "같은 항목은 문서 전체에서 똑같은 이름으로. 금액·날짜·비율은 숫자만(예: 1000000, 2026-05-20, 20).",
  "계산식은 곱하기 *, 나누기 / 로 적기 (예: 기준액 * 가산율 / 100).",
].forEach((t) => c.push(P("• " + t)));

// 1. 앱 개요
c.push(H("1. 앱 개요  →  ⓪ 앱 개요"));
c.push(tbl([
  ["항목", "내용"],
  ["앱 명", "퇴직금 예상금액 안내 앱"],
  ["한 줄 설명", "임직원의 근속·급여 정보를 입력하면 법정·약정 퇴직금 예상액을 자동으로 산출·안내합니다."],
  ["구축 목적", "퇴직 예정자에게 예상 퇴직금을 즉시 안내하고, 수기 계산 오류와 반복 문의를 줄이기 위해서입니다."],
  ["해결하려는 문제", "평균임금·근속연수 계산을 엑셀로 수기 처리하면 오류·형평성 문제와 문의 응대 부담이 큽니다."],
  ["대상 사용자", "HR 운영팀 · 보상 담당자 · 퇴직 예정 임직원"],
  ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반 · 처리 후 원본 즉시 폐기"],
  ["기대 효과", "산정 시간 80% 절감 · 산정 오류 최소화 · 퇴직금 문의 응대 감소"],
  ["핵심 특징", "자동 계산(사람 손 안 탐) · 퇴직유형별 가산 자동 분기 · 개인별 안내문 자동 생성"],
  ["처리 흐름 4단계", "1) 규정 지식화 → 2) 근속·급여 입력 → 3) 퇴직유형·근속 판단 → 4) 예상 퇴직금 산출·안내"],
], W_APP));

// 2. 규정 변수
c.push(H("2. 규정 변수  →  ① 규정 변수"));
c.push(tbl([
  ["변수명", "상위변수", "필수", "설명", "예시"],
  ["법정지급일수", "법정기준", "필수", "1년 근속당 지급하는 일수(30일분 평균임금)", "30"],
  ["1년환산일수", "법정기준", "필수", "1년을 며칠로 환산할지", "365"],
  ["최소지급근속년수", "—", "필수", "이 근속년수 미만이면 미지급", "1"],
  ["정년가산율", "가산율", "필수", "정년퇴직 시 가산 비율(%)", "20"],
  ["권고가산율", "가산율", "필수", "권고사직 시 가산 비율(%)", "10"],
  ["자발가산율", "가산율", "필수", "자발퇴직 시 가산 비율(%)", "0"],
], W_VAR));

// 3. 개인 변수
c.push(H("3. 개인 변수  →  ② 개인 변수"));
c.push(tbl([
  ["변수명", "상위변수", "필수", "설명", "예시"],
  ["성명", "기본정보", "필수", "신청자 이름", "홍길동"],
  ["사번", "기본정보", "필수", "사원 번호", "20180123"],
  ["부서", "기본정보", "선택", "소속 부서", "경영지원부"],
  ["입사일", "기본정보", "필수", "입사한 날짜", "2018-03-02"],
  ["퇴직유형", "—", "필수", "어떤 퇴직인지 — 계산이 갈리는 기준(분기축). 값: 정년퇴직/권고사직/자발퇴직", "정년퇴직"],
  ["퇴직예정일", "—", "필수", "퇴직 예정 날짜", "2026-06-30"],
  ["직전3개월임금총액", "평균임금", "필수", "퇴직 직전 3개월 임금 합계", "15000000"],
  ["직전3개월일수", "평균임금", "필수", "그 3개월의 총 일수", "92"],
], W_VAR));
c.push(Bold("★ 계산이 갈리는 기준(분기축): 퇴직유형 / 가능한 값: 정년퇴직 · 권고사직 · 자발퇴직  → 값마다 경로를 1개씩 만듭니다.", "B45309"));

// 4. 분석 로직
c.push(H("4. 분석 로직  →  ③ 분석 로직"));
c.push(Bold("공통 사전 계산 (모든 경우에 먼저 계산)"));
c.push(tbl([
  ["변수", "단위", "내용"],
  ["근속일수", "일", "입사일 → 퇴직예정일 사이의 일수"],
  ["근속연수", "년", "입사일 → 퇴직예정일 사이의 연수"],
  ["1일평균임금", "원", "직전3개월임금총액 / 직전3개월일수"],
  ["법정퇴직금", "원", "1일평균임금 * 법정지급일수 * (근속일수 / 1년환산일수)"],
], W_LOG));
const pathBlock = (label, rows) => {
  c.push(Bold(label));
  c.push(tbl([["변수", "단위", "내용"], ...rows], W_LOG));
};
pathBlock("경로 1 — 진입조건: 퇴직유형 = \"정년퇴직\"", [
  ["가산금", "원", "법정퇴직금 * 정년가산율 / 100"],
  ["예상퇴직금", "원", "법정퇴직금 + 가산금"],
  ["LLM분석", "—", "정년퇴직 예상 퇴직금·산정 근거 안내"],
]);
pathBlock("경로 2 — 진입조건: 퇴직유형 = \"권고사직\"", [
  ["가산금", "원", "법정퇴직금 * 권고가산율 / 100"],
  ["예상퇴직금", "원", "법정퇴직금 + 가산금"],
  ["LLM분석", "—", "권고사직 예상 퇴직금·산정 근거 안내"],
]);
pathBlock("경로 3 — 진입조건: 퇴직유형 = \"자발퇴직\"", [
  ["예상퇴직금", "원", "법정퇴직금 (가산 없음)"],
  ["LLM분석", "—", "자발퇴직 예상 퇴직금·산정 근거 안내"],
]);
c.push(Bold("Fallback — 진입조건: 없음 (근속 1년 미만 등)"));
c.push(P("계산 없음 — \"근속 1년 미만으로 법정 퇴직금 지급 대상이 아닙니다.\" 안내문만 표시."));

// 5. 리포트 (차트 포함)
c.push(H("5. 경로별 리포트 구성  →  ④ 리포트 구성"));
c.push(Bold("사용 가능한 카드 종류 (이 중에서 골라 쓰세요)"));
[
  "기본: fields(기본정보 묶음) · field(단일 정보) · card(숫자 카드) · note(안내문) · calc(계산식 한 줄) · compare(판정 비교표) · incexc(포함/제외 태그) · pathlabel(경로 라벨)",
  "차트: gauge · bar · step · donut · ratio · bullet · stacked · comparison · delta",
].forEach((t) => c.push(P("• " + t)));
const rptTable = (label, rows) => {
  c.push(Bold(label));
  c.push(tbl([["출력 변수", "종류"], ...rows], W_RPT));
};
rptTable("경로 1 — 정년퇴직 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["예상퇴직금", "card"],
  ["근속연수", "card"],
  ["법정퇴직금 vs 예상퇴직금", "chart(comparison)"],
  ["가산금 vs 법정퇴직금", "chart(delta)"],
]);
rptTable("경로 2 — 권고사직 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["예상퇴직금", "card"],
  ["법정퇴직금 vs 예상퇴직금", "chart(comparison)"],
]);
rptTable("경로 3 — 자발퇴직 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["예상퇴직금", "card"],
  ["1일평균임금", "chart(gauge)"],
]);
rptTable("Fallback — 미지급 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["근속 1년 미만으로 지급 대상이 아닙니다.", "note"],
]);

const doc = new Document({
  sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: c }],
});
const out = path.join(process.cwd(), "public/samples/퇴직금_예상금액_기획서3.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("생성됨:", out, `(${buf.length} bytes)`);
});
