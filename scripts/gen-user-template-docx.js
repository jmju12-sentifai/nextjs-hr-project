// 사용자 배포용 기획서 템플릿(public/samples/template.docx) 생성
// — 빌더 "⬇ 기획서 다운로드" 버튼이 서빙하는 파일. 경조사 지원금 예시로 채워진 작성 양식.
// 실행: node scripts/gen-user-template-docx.js
//
// v2: 선택형(select) 변수 표기 규칙 반영 —
//   값이 정해진 항목은 설명 칸에 「값: 후보1/후보2/…」 로 허용값을 전부 나열.
//   분석 파이프라인이 이를 선택형 변수(options)로 변환해 사용자 화면에서 콤보박스가 된다.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, TableLayoutType, WidthType, BorderStyle,
} = require("docx");

const FONT = "맑은 고딕";
const H = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 60 }, children: [new TextRun({ text, font: FONT, bold: true, size: 24, color: "1D4ED8" })] });
const Title = (text) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, font: FONT, bold: true, size: 30, color: "1D4ED8" })] });
const Bold = (text, color) => new Paragraph({ spacing: { before: 80, after: 30 }, children: [new TextRun({ text, font: FONT, bold: true, size: 18, color })] });
const P = (text) => new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text, font: FONT, size: 17 })] });
const Bullet = (text, color) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 10 }, children: [new TextRun({ text, font: FONT, size: 17, color })] });

// "\n" 을 포함한 셀은 여러 줄로 렌더 — 예시 칸의 "예시값 ↵ 값: 후보목록" 표기용
const cell = (text, widthDxa, { bold = false, fill } = {}) =>
  new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: fill ? { fill } : undefined,
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: String(text)
      .split("\n")
      .map(
        (line, i) =>
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: line,
                font: FONT,
                bold,
                size: 16,
                color: i > 0 ? "6B7280" : undefined, // 둘째 줄(값: 목록)은 회색으로 구분
              }),
            ],
          })
      ),
  });
const tbl = (rows, widths) =>
  new Table({
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" },
      bottom: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" },
      left: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" },
      right: { style: BorderStyle.SINGLE, size: 3, color: "C9D2DD" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: "E6EAEF" },
      insideVertical: { style: BorderStyle.SINGLE, size: 3, color: "E6EAEF" },
    },
    rows: rows.map((r, i) =>
      new TableRow({
        tableHeader: i === 0,
        children: r.map((cc, ci) => cell(cc, widths[ci], i === 0 ? { bold: true, fill: "EAF1FB" } : {})),
      })
    ),
  });

const W_OVERVIEW = [2200, 7000];
const W_VARS = [1500, 1200, 900, 700, 3300, 1600]; // 변수명·상위변수·타입·필수·설명·예시
const W_LOGIC = [1900, 800, 6500];            // 변수·단위·내용
const W_RPT = [6400, 2800];                   // 출력 변수·종류

const c = [];
c.push(Title("앱 기획서 템플릿"));
c.push(Bold("작성 규칙 (꼭 지킬 것)"));
[
  "표 안에 글자로만 채우기 — 이미지·캡처·셀 합치기 금지(값이 깨집니다).",
  "같은 항목은 문서 전체에서 똑같은 이름으로. 금액·날짜·비율은 숫자만(예: 1000000, 2026-05-20, 20).",
  "계산식은 곱하기 *, 나누기 / 로 적기 (예: 기준액 * 가산율 / 100).",
  "변수 타입은 4가지: number(숫자) · text(텍스트) · date(날짜, YYYY-MM-DD) · 선택형(정해진 값 중 택1).",
  "선택형 항목(…유형·…방식·분기축 등)은 타입 칸에 「선택형」 이라고 쓰고, 예시 칸에 예시값 다음 줄로 「값: 후보1/후보2/…」 를 적어 허용값을 전부 나열하세요 — 앱에서 콤보박스가 되고, 문서 파싱도 그 값 중에서만 고릅니다.",
  "「값: …」 을 적지 않은 항목은 자유 입력(텍스트)으로 남습니다. 경력내역·보유자격처럼 여러 건을 적는 목록 항목은 선택형이 아닙니다 — 타입을 text 로 두고 「값: …」 을 쓰지 마세요.",
].forEach((t) => c.push(Bullet(t)));

c.push(H("1. 앱 개요  →  ⓪ 앱 개요"));
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
], W_OVERVIEW));

c.push(H("2. 규정 변수  →  ① 규정 변수"));
c.push(tbl([
  ["변수명", "상위변수", "타입", "필수", "설명", "예시"],
  ["결혼지원금", "지급기준액", "number", "필수", "결혼 시 지원하는 금액", "1000000"],
  ["사망지원금", "지급기준액", "number", "필수", "사망(조위금) 지원 금액", "2000000"],
  ["출산지원금", "지급기준액", "number", "필수", "출산 축하 지원 금액", "500000"],
  ["지급방식", "운영기준", "선택형", "필수", "지원금 지급 방식", "일시금\n값: 일시금/분할"],
  ["관계가산율", "—", "number", "필수", "직계/방계 등 관계에 따른 가산 비율(%)", "20"],
  ["최대지원한도", "—", "number", "필수", "1인당 받을 수 있는 최대 금액", "3000000"],
], W_VARS));

c.push(H("3. 개인 변수  →  ② 개인 변수"));
c.push(tbl([
  ["변수명", "상위변수", "타입", "필수", "설명", "예시"],
  ["성명", "기본정보", "text", "필수", "신청자 이름", "홍길동"],
  ["사번", "기본정보", "text", "필수", "사원 번호", "20200123"],
  ["부서", "기본정보", "text", "선택", "소속 부서", "경영지원부"],
  ["경조분류", "—", "선택형", "필수", "어떤 경조사인지 — 계산이 갈리는 기준 (분기축)", "결혼\n값: 결혼/사망/출산"],
  ["대상자관계", "—", "선택형", "선택", "대상자와의 관계", "본인\n값: 본인/배우자/자녀"],
  ["발생일", "신청내역", "date", "필수", "경조사가 발생한 날짜", "2026-05-10"],
  ["신청일", "신청내역", "date", "필수", "지원금을 신청한 날짜", "2026-05-20"],
], W_VARS));
c.push(P("★ 계산이 갈리는 기준(분기축): 경조분류 / 가능한 값: 결혼 · 사망 · 출산  → 값마다 경로(아래 4번)를 1개씩 만듭니다."));

c.push(H("4. 분석 로직  →  ③ 분석 로직"));
c.push(Bold("공통 사전 계산 (모든 경우에 먼저 계산 · 없으면 비움)"));
c.push(tbl([
  ["변수", "단위", "내용"],
  ["신청경과일", "일", "발생일 → 신청일 사이의 일수"],
], W_LOGIC));
c.push(Bold("경로 1 — 진입조건: 경조분류 = \"결혼\""));
c.push(tbl([
  ["변수", "단위", "내용"],
  ["기본지원금", "원", "결혼지원금 * (1 + 관계가산율 / 100)"],
  ["최종지원금", "원", "기본지원금을 최대지원한도 이하로 맞춤"],
  ["LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
], W_LOGIC));
c.push(Bold("경로 2 — 진입조건: 경조분류 = \"사망\""));
c.push(tbl([
  ["변수", "단위", "내용"],
  ["기본지원금", "원", "사망지원금 * (1 + 관계가산율 / 100)"],
  ["최종지원금", "원", "기본지원금을 최대지원한도 이하로 맞춤"],
  ["LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
], W_LOGIC));
c.push(Bold("경로 3 — 진입조건: 경조분류 = \"출산\""));
c.push(tbl([
  ["변수", "단위", "내용"],
  ["최종지원금", "원", "출산지원금 (가산 없음)"],
  ["LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
], W_LOGIC));

c.push(H("5. 경로별 리포트 구성  →  ④ 리포트 구성"));
c.push(Bold("사용 가능한 카드 종류 (이 중에서 골라 쓰세요)"));
[
  "기본: fields(기본정보 묶음) · field(기본정보) · card(요약 카드) · note(안내문) · calc(산출 근거) · compare(판단 근거 비교표) · incexc(포함/제외 태그) · pathlabel(경로 정보)",
  "차트: gauge(게이지) · bar(구간 막대 차트) · step(구간 계단선) · donut(포함/제외 도넛) · ratio(비율 게이지) · bullet(불릿 차트) · stacked(누적 가로 막대) · comparison(이중 막대) · delta(Δ 변화량)",
].forEach((t) => c.push(Bullet(t)));
const rpt = (label, rows) => {
  c.push(Bold(label));
  c.push(tbl([["출력 변수", "종류"], ...rows], W_RPT));
};
rpt("경로 1 — 결혼 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["최종지원금", "card"],
]);
rpt("경로 2 — 사망 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["최종지원금", "card"],
]);
rpt("경로 3 — 출산 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["LLM분석", "note"],
  ["최종지원금", "card"],
]);
rpt("Fallback — 미적용 리포트", [
  ["성명 · 사번 · 부서", "fields"],
  ["경조 지원 대상이 아닙니다.", "note"],
]);

const doc = new Document({
  sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: c }],
});
const out = path.join(process.cwd(), "public/samples/template.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("생성됨:", out, `(${buf.length} bytes)`);
});
