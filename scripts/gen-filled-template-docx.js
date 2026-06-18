// 기획서_템플릿_수정2.docx — 비개발자용 예시·설명 채움 (형태 유지) 생성 (1회용)
// 실행: node scripts/gen-filled-template-docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, TableLayoutType, WidthType, BorderStyle,
} = require("docx");

const FONT = "맑은 고딕";
const H = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 40 }, children: [new TextRun({ text: t, font: FONT, bold: true, size: 22, color: "1D4ED8" })] });
const Bold = (t, color) => new Paragraph({ spacing: { before: 60, after: 20 }, children: [new TextRun({ text: t, font: FONT, bold: true, size: 17, color })] });
const Help = (t) => new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "💬 " + t, font: FONT, size: 15, color: "047857" })] }); // 비개발자 설명(초록)
const Note = (t) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: t, font: FONT, italics: true, color: "6B7280", size: 15 })] });
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

const W_VAR = [2100, 1500, 900, 2900, 1600];  // 변수명·상위변수·필수·설명·예시
const W_LOG = [2300, 1000, 5700];             // 변수·단위·내용
const W_RPT = [5600, 3400];                   // 출력 변수·종류
const W_APP = [2200, 6800];

const c = [];
c.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "경조사 지원금 자동 안내 앱 기획서 (작성 예시)", font: FONT, bold: true, size: 28, color: "1D4ED8" })] }));
c.push(Help("아래는 '경조사 지원금' 을 예시로 채운 양식입니다. 칸의 내용을 본인 회사 규정에 맞게 바꿔 채운 뒤, 빌더 \"참고 문서 분석\"에 올리면 5개 탭이 자동으로 만들어집니다."));
c.push(Bold("작성 규칙 (꼭 지킬 것)"));
[
  "표 안에 글자로만 채우기 — 이미지·캡처·셀 합치기 금지(값이 깨집니다).",
  "같은 항목은 문서 전체에서 똑같은 이름으로. 금액·날짜·비율은 숫자만(예: 1000000, 2026-05-20, 20).",
  "계산식은 곱하기 *, 나누기 / 로 적기 (예: 기준액 * 가산율 / 100).",
].forEach((t) => c.push(P("• " + t)));

// 1. 앱 개요
c.push(H("1. 앱 개요  →  ⓪ 앱 개요"));
c.push(Help("이 앱이 무엇을 해주는 앱인지 소개하는 칸이에요. 빈칸을 한두 문장으로 채우면 됩니다."));
c.push(tbl([
  ["항목", "내용"],
  ["앱 명", "경조사 지원금 자동 안내 앱"],
  ["한 줄 설명", "임직원의 경조 신청을 입력하면 지원금과 안내문을 자동으로 만들어 줍니다."],
  ["구축 목적", "경조사 지원금을 수기로 계산할 때 생기는 시간 낭비·실수를 줄이고, 직원에게 즉시 안내하기 위해서입니다."],
  ["해결하려는 문제", "분류·관계별로 지원금이 달라 매번 규정을 찾아 계산해야 하고, 담당자마다 결과가 달라질 수 있습니다."],
  ["대상 사용자", "HR 운영팀 · 복리후생 담당자 · 신청 임직원"],
  ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반 · 처리 후 원본 즉시 폐기"],
  ["기대 효과", "처리 시간 70% 절감 · 지급 오류 최소화 · 문의 응대 감소"],
  ["핵심 특징", "자동 계산(사람 손 안 탐) · 경조분류별 자동 분기 · 개인별 안내문 자동 생성"],
  ["처리 흐름 4단계", "1) 규정 지식화 → 2) 신청 정보 입력 → 3) 분류별 지원금 판단 → 4) 지원금 산출·안내"],
], W_APP));

// 2. 규정 변수
c.push(H("2. 규정 변수  →  ① 규정 변수"));
c.push(Help("회사가 미리 정해 둔 값이에요 (지원금 액수, 한도 등). 직원이 입력하는 게 아니라 규정에 적힌 값입니다."));
c.push(Note("· 상위변수: 여러 개를 한 묶음으로 묶고 싶을 때 묶음 이름. 안 묶으면 — 로 두세요.  · 필수: 규정값은 보통 '필수'.  · 예시: 실제 값."));
c.push(tbl([
  ["변수명", "상위변수", "필수", "설명", "예시"],
  ["결혼지원금", "지급기준액", "필수", "결혼 시 지원하는 금액", "1000000"],
  ["사망지원금", "지급기준액", "필수", "사망(조위금) 지원 금액", "2000000"],
  ["출산지원금", "지급기준액", "필수", "출산 축하 지원 금액", "500000"],
  ["관계가산율", "—", "필수", "직계/방계 등 관계에 따른 가산 비율(%)", "20"],
  ["최대지원한도", "—", "필수", "1인당 받을 수 있는 최대 금액", "3000000"],
], W_VAR));

// 3. 개인 변수
c.push(H("3. 개인 변수  →  ② 개인 변수"));
c.push(Help("직원이 신청할 때 입력하는 값이에요 (이름, 어떤 경조사인지, 날짜 등). 사람마다 달라지는 값입니다."));
c.push(Note("· '분기축'이라고 적은 변수는 '이 값에 따라 계산이 갈리는 기준' 이에요 (예: 결혼이냐 사망이냐)."));
c.push(tbl([
  ["변수명", "상위변수", "필수", "설명", "예시"],
  ["성명", "기본정보", "필수", "신청자 이름", "홍길동"],
  ["사번", "기본정보", "필수", "사원 번호", "20200123"],
  ["부서", "기본정보", "선택", "소속 부서", "경영지원부"],
  ["경조분류", "—", "필수", "어떤 경조사인지 — 계산이 갈리는 기준 (분기축). 값: 결혼/사망/출산", "결혼"],
  ["대상자관계", "—", "선택", "본인/배우자/자녀 등 대상자와의 관계", "본인"],
  ["발생일", "신청내역", "필수", "경조사가 발생한 날짜", "2026-05-10"],
  ["신청일", "신청내역", "필수", "지원금을 신청한 날짜", "2026-05-20"],
], W_VAR));
c.push(Bold("★ 계산이 갈리는 기준(분기축): 경조분류 / 가능한 값: 결혼 · 사망 · 출산  → 값마다 경로(아래 4번)를 1개씩 만듭니다.", "B45309"));

// 4. 분석 로직
c.push(H("4. 분석 로직  →  ③ 분석 로직"));
c.push(Help("입력값으로 지원금을 '어떻게 계산할지' 정하는 곳이에요. 위에서 정한 변수 이름을 그대로 써서 계산식을 적습니다."));
c.push(Bold("공통 사전 계산 (모든 경우에 먼저 계산 · 없으면 비움)"));
c.push(Help("어느 경조사든 공통으로 먼저 계산해 둘 값이에요 (예: 신청까지 며칠 걸렸는지)."));
c.push(tbl([
  ["변수", "단위", "내용"],
  ["신청경과일", "일", "발생일 → 신청일 사이의 일수"],
], W_LOG));

const pathBlock = (label, rows) => {
  c.push(Bold(label));
  c.push(tbl([["변수", "단위", "내용"], ...rows], W_LOG));
};
c.push(Help("경조분류 값에 따라 경로가 갈립니다. '결혼'이면 경로1, '사망'이면 경로2 처럼요. 값마다 경로를 하나씩 만드세요."));
pathBlock("경로 1 — 진입조건: 경조분류 = \"결혼\"", [
  ["기본지원금", "원", "결혼지원금 * (1 + 관계가산율 / 100)"],
  ["최종지원금", "원", "기본지원금을 최대지원한도 이하로 맞춤"],
  ["LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
]);
pathBlock("경로 2 — 진입조건: 경조분류 = \"사망\"", [
  ["기본지원금", "원", "사망지원금 * (1 + 관계가산율 / 100)"],
  ["최종지원금", "원", "기본지원금을 최대지원한도 이하로 맞춤"],
  ["LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
]);
pathBlock("경로 3 — 진입조건: 경조분류 = \"출산\"", [
  ["최종지원금", "원", "출산지원금 (가산 없음)"],
  ["LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
]);
c.push(Bold("Fallback — 진입조건: 없음 (위 어디에도 안 맞을 때)"));
c.push(P("계산 없음 — \"경조 지원 대상이 아닙니다. 신청 분류를 확인해 주세요.\" 안내문만 표시."));

// 5. 리포트
c.push(H("5. 경로별 리포트 구성  →  ④ 리포트 구성"));
c.push(Help("결과 화면에 무엇을 보여줄지 고르는 곳이에요. 아래 '종류' 중에서 골라 '출력 변수'에 보여줄 값을 적습니다."));
c.push(Bold("사용 가능한 카드 종류 (이 중에서 골라 쓰세요)"));
[
  "기본: fields(기본정보 묶음) · field(단일 정보) · card(숫자 카드) · note(안내문) · calc(계산식 한 줄) · compare(판정 비교표) · incexc(포함/제외 태그) · pathlabel(경로 라벨)",
  "차트: gauge · bar · step · donut · ratio · bullet · stacked · comparison · delta",
].forEach((t) => c.push(P("• " + t)));
const rptTable = (label, rows) => {
  c.push(Bold(label));
  c.push(tbl([["출력 변수", "종류"], ...rows], W_RPT));
};
rptTable("경로 1 — 결혼 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["최종지원금", "card"],
]);
rptTable("경로 2 — 사망 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["최종지원금", "card"],
]);
rptTable("경로 3 — 출산 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["최종지원금", "card"],
]);
rptTable("Fallback — 미적용 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["경조 지원 대상이 아닙니다.", "note"],
]);
c.push(P(""));
c.push(Help("다 채웠으면 — 빌더의 \"참고 문서 분석\"에 이 파일을 올리세요. 위 내용대로 5개 탭이 자동으로 채워집니다."));

const doc = new Document({
  sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: c }],
});
const out = path.join(process.cwd(), "public/samples/기획서_템플릿_수정2.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("생성됨:", out, `(${buf.length} bytes)`);
});
