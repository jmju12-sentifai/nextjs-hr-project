// 기획서 템플릿 → .docx (컴팩트 기획서형) 생성 (1회용)
// 실행: node scripts/gen-template-docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, TableLayoutType, WidthType, AlignmentType, BorderStyle,
} = require("docx");

const FONT = "맑은 고딕";
const H = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 40 }, children: [new TextRun({ text, font: FONT, bold: true, size: 22, color: "1D4ED8" })] });
const Bold = (text, color) => new Paragraph({ spacing: { before: 60, after: 20 }, children: [new TextRun({ text, font: FONT, bold: true, size: 17, color })] });
const Note = (text) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text, font: FONT, italics: true, color: "6B7280", size: 15 })] });
const P = (text) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text, font: FONT, size: 16 })] });
const Bullet = (text, color) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 8 }, children: [new TextRun({ text, font: FONT, size: 16, color })] });

const cell = (text, widthDxa, { bold = false, fill } = {}) =>
  new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
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

const W2 = [2200, 6800];
const W_REG = [1300, 2900, 1100, 1100, 2600];          // 하위묶음·변수명·타입·단위·예시값
const W_PER = [1200, 2500, 1000, 850, 850, 2600];      // 하위묶음·변수명·타입·단위·필수·예시값
const W_LOGIC = [500, 1600, 1800, 700, 4400];
const W_RPT = [2000, 2400, 900, 2700];
const W_RPTP = [2200, 5000, 1800];

const c = [];
c.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "[앱 이름] 기획서 — 참고 문서 분석 입력 양식 (범용)", font: FONT, bold: true, size: 28, color: "1D4ED8" })] }));
c.push(Note("[대괄호]만 채워 빌더 \"참고 문서 분석\"에 올리면 5탭(앱 개요·규정 변수·개인 변수·분석 로직·리포트)이 자동으로 채워집니다."));
c.push(Bold("작성 규칙 (파싱 정확도 — 꼭 지킬 것)"));
[
  "순수 텍스트(표)로만 — 이미지·캡처·병합셀 금지(값이 깨짐). 변수명은 공백·괄호·단위 없이 짧게(단위는 단위 칸에만).",
  "같은 항목은 문서 전체에서 같은 이름으로. 금액·날짜·비율은 숫자 그대로(예: 1000000, 2026-05-20, 20).",
].forEach((t) => c.push(Bullet(t)));
[
  "★ 경로는 진입조건(AND)으로 갈린다 — 각 경로의 조건을 명확히.",
  "★ 케이스를 빠뜨리지 말 것 — 분류 변수로 갈리면 분류값마다, 숫자 기준으로 갈리면 구간마다 경로.",
  "★ 조건·산식·리포트의 변수명 = 변수 정의 이름과 글자 그대로 일치.",
].forEach((t) => c.push(Bullet(t, "B45309")));
c.push(Note("경로 진입조건 = 그 경로로 들어가는 기준(변수·연산자·값). ① 분류 동등비교(경조분류==\"사망\") → 분류값마다 경로  ② 숫자 비교/구간(만나이>=56 AND <=58) → 구간마다 경로. 둘을 AND 로 섞어도 됨. 갈림 없는 단순 판정이면 경로 1개 + Fallback."));

c.push(H("1. 앱 개요  →  ⓪ 앱 개요"));
c.push(tbl([
  ["항목", "내용"],
  ["앱 명", "[예: ○○ 자동화 마이크로 SaaS 앱]"],
  ["한 줄 설명", "[임직원 정보를 파싱해 ○○ 적용 여부·금액·시기를 자동 산출]"],
  ["구축 목적", "[수작업 ○○ 업무를 자동화해 시간·오류·일관성 문제 해결 — 2~3문장]"],
  ["해결하려는 문제", "[규정 해석·개인별 판단을 수기로 할 때의 시간·오류 — 1~2문장]"],
  ["대상 사용자", "[예: HR 운영팀 · ○○ 담당자 · 보상 컨설턴트]"],
  ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반 · 처리 후 원본 즉시 폐기"],
  ["기대 효과", "[업무 시간 N% 절감 · 오류 최소화 · 컴플라이언스 강화 — 3~5개]"],
  ["핵심 특징", "[결정론 계산 · 분류값별 다중 경로 분기 · 안내문 자동 생성 — 3~5개]"],
  ["처리 흐름 4단계", "1) 기준 지식화 [정책 상수 정의] → 2) 개인 정보 파싱 [임직원 1인 데이터] → 3) 적용 판단·분석 [분기·산출] → 4) 산출 및 안내 [결과·안내자료]"],
], W2));

c.push(H("2. 규정 변수  →  ① 규정 변수"));
c.push(Note("회사가 정한 값(기준액·비율·연령·한도·기한). 상위 묶음 = 소제목, 하위 묶음 = 표의 \"하위묶음\" 칸. 하위가 없으면 — 로 두세요."));
c.push(Bold("타입·단위 안내 (규정·개인 변수 공통)"));
c.push(tbl([
  ["타입", "뜻", "단위 사용", "예"],
  ["number", "숫자 — 계산·비교에 사용", "사용함", "1000000 / 20 / 56"],
  ["text", "텍스트 — 이름·분류값 등", "없음 (—)", "홍길동 / 정년퇴직"],
  ["date", "날짜 — YYYY-MM-DD", "없음 (—)", "2026-07-01"],
], [1400, 4200, 1600, 1800]));
c.push(Note("단위는 number 일 때만 다음 중 택1: 원 · 일 · 명 · % · 배 · 점 · 개 · 년 · 월 · 시간 · 건 · 회 (해당 없으면 — / 빈칸). text·date 는 단위 없음(—)."));
c.push(Bold("상위 묶음: [예: 경조 지급 기준액]"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "예시값"],
  ["[결혼]", "[결혼_지원금]", "number", "원", "[예: 1000000]"],
  ["[사망]", "[사망_조위금]", "number", "원", "[예: 2000000]"],
  ["[출산]", "[출산_지원금]", "number", "원", "[예: 500000]"],
  ["—", "[최대지원한도]", "number", "원", "[예: 3000000]"],
], W_REG));
c.push(Bold("상위 묶음: [예: 가산·기준]"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "예시값"],
  ["—", "[관계가산율]", "number", "%", "[예: 20]"],
  ["—", "[기준일]", "date", "—", "[예: 2026-07-01]"],
], W_REG));
c.push(Note("분류값마다 다른 정책 금액은 [도메인]_[분류값] 패턴 + 하위묶음으로 표현 (예: 상위=경조 지급 기준액, 하위=결혼, 변수=결혼_지원금)."));

c.push(H("3. 개인 변수  →  ② 개인 변수"));
c.push(Note("임직원 1명마다 다른 값(신청서·인사정보에서). 상위 묶음 = 소제목, 하위 묶음 = \"하위묶음\" 칸."));
c.push(Bold("상위 묶음: 기본정보"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "필수", "예시값"],
  ["—", "성명", "text", "—", "필수", "[예: 홍길동]"],
  ["—", "사번", "text", "—", "필수", "[예: 20200123]"],
  ["—", "부서", "text", "—", "선택", "[예: ○○본부]"],
  ["—", "직급", "text", "—", "선택", "[예: 과장]"],
  ["—", "[생년월일/입사일 등]", "date", "—", "필수", "[YYYY-MM-DD]"],
], W_PER));
c.push(Bold("상위 묶음: [도메인 신청정보 · 예: 경조 신청정보]"));
c.push(tbl([
  ["하위묶음", "변수명", "타입", "단위", "필수", "예시값"],
  ["—", "[분기축 변수명 · 예: 퇴직유형] (분기축)", "text", "—", "필수", "[분류값 1개 · 예: 정년퇴직]"],
  ["—", "[보조 분류 · 예: 대상자관계]", "text", "—", "선택", "[예: 본인/배우자/자녀]"],
  ["[신청내역]", "[금액1]", "number", "원", "필수", "[예: 5500000]"],
  ["[신청내역]", "[발생일]", "date", "—", "필수", "[예: 2026-05-10]"],
], W_PER));
c.push(Bold("★ 경로 나누는 방법 — 둘 중 하나:", "B45309"));
c.push(P("(가) 종류로 나눔 — 종류를 담은 변수(=분기축)와 그 값을 적고 값마다 경로 1개.  예) 분기축=퇴직유형 / 분류값=정년퇴직 · 권고사직 · 자발퇴직  (또는 경조분류=사망·결혼·출산·입학)"));
c.push(P("(나) 숫자로 나눔 — 분기축 없이, 각 경로의 진입조건 표에 숫자 조건을 적음.  예) 근속연수 >= 5  /  만나이 <= 58"));

c.push(H("4. 분석 로직  →  ③ 분석 로직"));
c.push(Note("공통 사전 계산 → 분류값별 경로(first-match) → Fallback. 타입: date·classify·table·formula·clamp·branch·switch·llm."));
c.push(Bold("★ 경로는 진입조건으로 갈림. 케이스를 빠뜨리지 말 것 — 분류값마다(동등비교) 또는 구간마다(숫자비교) 경로. 조건은 조건표(변수·연산자·값)로, 여러 줄이면 AND.", "B45309"));
c.push(Bold("공통 사전 계산 (모든 경로 진입 전 · 없으면 비움)"));
c.push(tbl([
  ["#", "타입", "결과변수", "단위", "내용"],
  ["1", "date(diff)", "[만나이]", "년", "[생년월일] → [기준일] 차이"],
  ["2", "date(diff)", "[경과일수]", "일", "[발생일] → [신청일] 차이"],
  ["3", "switch", "[분류별값]", "[원]", "[분기축/보조분류] 값에 따라 정책 변수 선택"],
], W_LOGIC));
const W_COND = [3400, 1600, 4000];
const pathBlock = (label, condNote, condRows, rows) => {
  c.push(Bold(label));
  c.push(Bold("진입조건 (AND)" + (condNote ? "  — " + condNote : "")));
  c.push(tbl([["변수", "연산자", "값/변수"], ...condRows], W_COND));
  c.push(Bold("산출"));
  c.push(tbl([["#", "타입", "결과변수", "단위", "내용"], ...rows], W_LOGIC));
};
pathBlock("경로 1 — [분류값1 또는 경로 라벨]", "", [
  ["[분기축 변수명]", "==", "\"[분류값1]\""],
], [
  ["1", "classify(sum)", "[집계금액]", "원", "[기본급] + [수당] (체크 항목 합)"],
  ["2", "table", "[적용률]", "%", "구간별 차등 적용률"],
  ["3", "formula", "[1차결과]", "원", "[집계금액] × [적용률]"],
  ["4", "clamp", "[최종금액]", "원", "[최저보장액] 이상으로 보정"],
  ["5", "llm", "LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
]);
pathBlock("경로 2 — [분류값2 또는 경로 라벨]", "숫자 구간으로 갈리는 예 (여러 줄 = AND)", [
  ["[만나이]", ">=", "56"],
  ["[만나이]", "<=", "58"],
], [
  ["1", "formula", "[최종금액]", "원", "[경로2 전용 산식]"],
  ["2", "llm", "LLM분석", "—", "[경로2] 전용 안내 메시지"],
]);
c.push(Note("케이스가 더 있으면 경로 블록 복제해 조건·산출 추가. first-match — 위→아래, 좁은 조건을 위로."));
c.push(Bold("Fallback — [미적용 / 대상 아님 라벨]"));
c.push(P("조건 없음(어느 경로도 매칭 안 됨). 산출 블록 없음 — 안내문만 표시 (예: \"○○ 적용 대상이 아닙니다\")."));

c.push(H("5. 경로별 리포트 구성  →  ④ 리포트 구성"));
c.push(Note("각 경로마다 보여줄 카드를 직접 채웁니다. 아래 \"사용 가능한 종류(팔레트)\"에서 골라 경로별 표에 종류·바인딩·사이즈를 적으세요. 사이즈 = WxH(전체 폭 6). 배치 순서: fields → note → 나머지."));
c.push(Bold("사용 가능한 카드 종류 (팔레트) — 아래 종류 중에서 골라 쓰세요", "1D4ED8"));
[
  "기본: fields(기본정보 묶음) · field(단일 정보) · card(숫자 카드) · note(안내문) · calc(계산식 한 줄) · compare(판정 비교표) · incexc(포함/제외 태그) · pathlabel(경로 라벨)",
  "차트(chart): gauge · bar · step · donut · ratio · bullet · stacked · comparison · delta",
].forEach((t) => c.push(Bullet(t)));
const reportTable = (label, rows) => {
  c.push(Bold(label + "  (팔레트에서 골라 채우기)"));
  c.push(tbl([["종류", "바인딩", "사이즈"], ...rows], W_RPTP));
};
reportTable("경로 1 — [분류값1 또는 경로 라벨] 리포트", [
  ["fields", "성명·사번·부서·직급", "6x1"],
  ["note", "{LLM분석}", "6x2"],
  ["card", "[최종금액]  ← 위 분석 로직의 산출 결과변수", "2x2"],
  ["[추가 카드…]", "[…]", "[…]"],
]);
reportTable("경로 2 — [분류값2 또는 경로 라벨] 리포트", [
  ["fields", "성명·사번·부서·직급", "6x1"],
  ["note", "{LLM분석}", "6x2"],
  ["card", "[최종금액]", "2x2"],
]);
reportTable("Fallback — 미적용 리포트", [
  ["fields", "성명·사번·부서·직급", "6x1"],
  ["note", "미적용 안내문 · 예: 적용 대상이 아닙니다.", "6x2"],
]);

c.push(H("작성 팁"));
[
  "[대괄호]만 도메인에 맞게 채우면 됨. 빈 항목은 AI 가 자동 보완. 다중 경로 불필요하면 경로 1개 + Fallback 만.",
  "셀프 체크 — ① 각 경로의 진입조건이 명확? ② 케이스(분류값/구간)를 빠짐없이 경로로? ③ 변수명 문서 전체 일관?",
].forEach((t) => c.push(Bullet(t)));

const doc = new Document({
  sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: c }],
});
const out = path.join(process.cwd(), "public/samples/기획서_템플릿.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("생성됨:", out, `(${buf.length} bytes)`);
});
