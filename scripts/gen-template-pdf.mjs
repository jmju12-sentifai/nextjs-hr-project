// 기획서 템플릿 → .pdf 생성 (1회용)  ·  실행: node scripts/gen-template-pdf.mjs
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToFile, Font } from "@react-pdf/renderer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "public", "samples", "기획서_템플릿.pdf");

Font.register({
  family: "NotoKR",
  fonts: [{ src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf", fontWeight: 400 }],
});
Font.registerHyphenationCallback((w) => [w]);

const S = StyleSheet.create({
  page: { padding: 38, fontFamily: "NotoKR", fontSize: 9, lineHeight: 1.45, color: "#1f2937" },
  title: { fontSize: 15, marginBottom: 3, color: "#1d4ed8" },
  sub: { fontSize: 8.5, color: "#6b7280", marginBottom: 8 },
  h2: { fontSize: 12, marginTop: 11, marginBottom: 4, color: "#1d4ed8" },
  bold: { marginTop: 5, marginBottom: 2 },
  star: { marginTop: 1, marginBottom: 1, color: "#b45309" },
  menu: { marginTop: 3, marginBottom: 2, color: "#1d4ed8" },
  p: { marginBottom: 2 },
  note: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  bullet: { flexDirection: "row", marginBottom: 1.3 },
  star_b: { flexDirection: "row", marginBottom: 1.3, color: "#b45309" },
  dot: { width: 9, color: "#1d4ed8" },
  table: { borderTop: "1px solid #d1d5db", borderLeft: "1px solid #d1d5db", marginTop: 3, marginBottom: 5 },
  tr: { flexDirection: "row" },
  th: { padding: 3.5, backgroundColor: "#eaf1fb", fontSize: 8, borderRight: "1px solid #d1d5db", borderBottom: "1px solid #d1d5db" },
  td: { padding: 3.5, fontSize: 8, borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" },
});

const e = React.createElement;
const Heading = (t) => e(Text, { style: S.h2 }, t);
const Bold = (t) => e(Text, { style: S.bold }, t);
const Menu = (t) => e(Text, { style: S.menu }, t);
const Para = (t) => e(Text, { style: S.p }, t);
const Note = (t) => e(Text, { style: S.note }, t);
const Bullet = (t, star) => e(View, { style: star ? S.star_b : S.bullet }, [e(Text, { style: [S.dot, star ? { color: "#b45309" } : {}], key: "d" }, "•"), e(Text, { style: { flex: 1, color: star ? "#b45309" : "#1f2937" }, key: "t" }, t)]);
const Table = (cols, rows) => {
  const ws = cols.map((cc) => cc.w);
  const tot = ws.reduce((a, b) => a + b, 0);
  const head = e(View, { style: S.tr, key: "h" }, cols.map((cc, i) => e(Text, { key: i, style: [S.th, { flex: ws[i] / tot }] }, cc.label)));
  const body = rows.map((r, ri) => e(View, { style: S.tr, key: ri, wrap: false }, r.map((cl, ci) => e(Text, { key: ci, style: [S.td, { flex: ws[ci] / tot }] }, String(cl)))));
  return e(View, { style: S.table }, [head, ...body]);
};
const cols = (...arr) => arr.map(([label, w]) => ({ label, w }));

const REG = cols(["하위묶음", 1.1], ["변수명", 2.2], ["타입", 0.9], ["단위", 0.8], ["예시값", 1.9]);
const PER = cols(["하위묶음", 1.1], ["변수명", 2.0], ["타입", 0.9], ["단위", 0.7], ["필수", 0.7], ["예시값", 1.9]);
const LOG = cols(["#", 0.4], ["타입", 1.2], ["결과변수", 1.3], ["단위", 0.6], ["내용", 2.8]);
const RPT = cols(["종류", 1.4], ["바인딩", 1.8], ["사이즈", 0.7], ["설명", 2.2]);
const RPTP = cols(["종류", 1.4], ["바인딩", 3.2], ["사이즈", 0.9]);
const COND = cols(["변수", 1.7], ["연산자", 0.8], ["값/변수", 2.0]);

const kids = [
  e(Text, { style: S.title, key: "t" }, "[앱 이름] 기획서 — 참고 문서 분석 입력 양식 (범용)"),
  e(Text, { style: S.sub, key: "s" }, "[대괄호]만 채워 빌더 \"참고 문서 분석\"에 올리면 5탭(앱 개요·규정 변수·개인 변수·분석 로직·리포트)이 자동으로 채워집니다."),

  Bold("작성 규칙 (파싱 정확도 — 꼭 지킬 것)"),
  Bullet("순수 텍스트(표)로만 — 이미지·캡처·병합셀 금지(값이 깨짐). 변수명은 공백·괄호·단위 없이 짧게(단위는 단위 칸에만)."),
  Bullet("같은 항목은 문서 전체에서 같은 이름으로. 금액·날짜·비율은 숫자 그대로 (예: 1000000, 2026-05-20, 20)."),
  Bullet("★ 경로는 진입조건(AND)으로 갈린다 — 각 경로의 조건을 명확히.", true),
  Bullet("★ 케이스를 빠뜨리지 말 것 — 분류 변수로 갈리면 분류값마다, 숫자 기준으로 갈리면 구간마다 경로.", true),
  Bullet("★ 조건·산식·리포트의 변수명 = 변수 정의 이름과 글자 그대로 일치.", true),
  Note("경로 진입조건 = 그 경로로 들어가는 기준(변수·연산자·값). ① 분류 동등비교(경조분류==\"사망\") → 분류값마다 경로  ② 숫자 비교/구간(만나이>=56 AND <=58) → 구간마다 경로. 갈림 없는 단순 판정이면 경로 1개 + Fallback."),

  Heading("1. 앱 개요  →  ⓪ 앱 개요"),
  Table(cols(["항목", 1.3], ["내용", 3]), [
    ["앱 명", "[예: ○○ 자동화 마이크로 SaaS 앱]"],
    ["한 줄 설명", "[임직원 정보를 파싱해 ○○ 적용 여부·금액·시기를 자동 산출]"],
    ["구축 목적", "[수작업 ○○ 업무를 자동화해 시간·오류·일관성 문제 해결 — 2~3문장]"],
    ["해결하려는 문제", "[규정 해석·개인별 판단을 수기로 할 때의 시간·오류 — 1~2문장]"],
    ["대상 사용자", "[예: HR 운영팀 · ○○ 담당자 · 보상 컨설턴트]"],
    ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반 · 처리 후 원본 즉시 폐기"],
    ["기대 효과", "[업무 시간 N% 절감 · 오류 최소화 · 컴플라이언스 강화 — 3~5개]"],
    ["핵심 특징", "[결정론 계산 · 분류값별 다중 경로 분기 · 안내문 자동 생성 — 3~5개]"],
    ["처리 흐름 4단계", "1) 기준 지식화 [정책 상수 정의] → 2) 개인 정보 파싱 [임직원 1인 데이터] → 3) 적용 판단·분석 [분기·산출] → 4) 산출 및 안내 [결과·안내자료]"],
  ]),

  Heading("2. 규정 변수  →  ① 규정 변수"),
  Note("회사가 정한 값(기준액·비율·연령·한도·기한). 상위 묶음 = 소제목, 하위 묶음 = \"하위묶음\" 칸. 하위 없으면 — 로."),
  Bold("타입·단위 안내 (규정·개인 변수 공통)"),
  Table(cols(["타입", 1], ["뜻", 3], ["단위 사용", 1.1], ["예", 1.4]), [
    ["number", "숫자 — 계산·비교에 사용", "사용함", "1000000 / 20 / 56"],
    ["text", "텍스트 — 이름·분류값 등", "없음 (—)", "홍길동 / 정년퇴직"],
    ["date", "날짜 — YYYY-MM-DD", "없음 (—)", "2026-07-01"],
  ]),
  Note("단위는 number 일 때만 택1: 원 · 일 · 명 · % · 배 · 점 · 개 · 년 · 월 · 시간 · 건 · 회 (없으면 —). text·date 는 단위 없음(—)."),
  Bold("상위 묶음: [예: 경조 지급 기준액]"),
  Table(REG, [
    ["[결혼]", "[결혼_지원금]", "number", "원", "[예: 1000000]"],
    ["[사망]", "[사망_조위금]", "number", "원", "[예: 2000000]"],
    ["[출산]", "[출산_지원금]", "number", "원", "[예: 500000]"],
    ["—", "[최대지원한도]", "number", "원", "[예: 3000000]"],
  ]),
  Bold("상위 묶음: [예: 가산·기준]"),
  Table(REG, [
    ["—", "[관계가산율]", "number", "%", "[예: 20]"],
    ["—", "[기준일]", "date", "—", "[예: 2026-07-01]"],
  ]),
  Note("분류값마다 다른 정책 금액은 [도메인]_[분류값] 패턴 + 하위묶음으로 (예: 상위=경조 지급 기준액, 하위=결혼, 변수=결혼_지원금)."),

  Heading("3. 개인 변수  →  ② 개인 변수"),
  Note("임직원 1명마다 다른 값. 상위 묶음 = 소제목, 하위 묶음 = \"하위묶음\" 칸."),
  Bold("상위 묶음: 기본정보"),
  Table(PER, [
    ["—", "성명", "text", "—", "필수", "[예: 홍길동]"],
    ["—", "사번", "text", "—", "필수", "[예: 20200123]"],
    ["—", "부서", "text", "—", "선택", "[예: ○○본부]"],
    ["—", "직급", "text", "—", "선택", "[예: 과장]"],
    ["—", "[생년월일/입사일 등]", "date", "—", "필수", "[YYYY-MM-DD]"],
  ]),
  Bold("상위 묶음: [도메인 신청정보 · 예: 경조 신청정보]"),
  Table(PER, [
    ["—", "[분기축 변수명] (분기축)", "text", "—", "필수", "[분류값1]"],
    ["—", "[관계/대상 등 보조 분류]", "text", "—", "선택", "[예: 본인/배우자/자녀]"],
    ["[신청내역]", "[금액1]", "number", "원", "필수", "[예: 5500000]"],
    ["[신청내역]", "[발생일]", "date", "—", "필수", "[예: 2026-05-10]"],
  ]),
  Bullet("★ 경로 나누는 방법 — 둘 중 하나:", true),
  Para("(가) 종류로 나눔 — 종류를 담은 변수(=분기축)와 그 값을 적고 값마다 경로 1개.  예) 분기축=[분기축 변수명] / 분류값=[분류값1] / [분류값2] / [분류값3] / [분류값4]"),
  Para("(나) 숫자로 나눔 — 분기축 없이, 각 경로의 진입조건 표에 숫자 조건을 적음.  예) 근속연수 >= 5  /  만나이 <= 58"),

  Heading("4. 분석 로직  →  ③ 분석 로직"),
  Note("공통 사전 계산 → 분류값별 경로(first-match) → Fallback. 타입: date·classify·table·formula·clamp·branch·switch·llm."),
  Bullet("★ 경로는 진입조건으로 갈림. 케이스를 빠뜨리지 말 것 — 분류값마다(동등비교) 또는 구간마다(숫자비교). 조건은 조건표(변수·연산자·값), 여러 줄이면 AND.", true),
  Bold("공통 사전 계산 (모든 경로 진입 전 · 없으면 비움)"),
  Table(LOG, [
    ["1", "date(diff)", "[만나이]", "년", "[생년월일] → [기준일] 차이"],
    ["2", "date(diff)", "[경과일수]", "일", "[발생일] → [신청일] 차이"],
    ["3", "switch", "[분류별값]", "[원]", "[분기축/보조분류] 값에 따라 정책 변수 선택"],
  ]),
  Bold("경로 1 — [분류값1 또는 경로 라벨]   ·  진입조건 (AND)"),
  Table(COND, [
    ["[분기축 변수명]", "==", "\"[분류값1]\""],
  ]),
  Bold("산출"),
  Table(LOG, [
    ["1", "classify(sum)", "[집계금액]", "원", "[기본급] + [수당] (체크 항목 합)"],
    ["2", "table", "[적용률]", "%", "구간별 차등 적용률"],
    ["3", "formula", "[1차결과]", "원", "[집계금액] × [적용률]"],
    ["4", "clamp", "[최종금액]", "원", "[최저보장액] 이상으로 보정"],
    ["5", "llm", "LLM분석", "—", "위 결과를 종합한 개인별 안내 메시지"],
  ]),
  Bold("경로 2 — [분류값2 또는 경로 라벨]   ·  진입조건 (AND, 숫자 구간 예 — 여러 줄 = AND)"),
  Table(COND, [
    ["[만나이]", ">=", "56"],
    ["[만나이]", "<=", "58"],
  ]),
  Bold("산출"),
  Table(LOG, [
    ["1", "formula", "[최종금액]", "원", "[경로2 전용 산식]"],
    ["2", "llm", "LLM분석", "—", "[경로2] 전용 안내 메시지"],
  ]),
  Note("케이스가 더 있으면 경로 블록 복제해 조건·산출 추가. first-match — 위→아래, 좁은 조건을 위로."),
  Bold("Fallback — [미적용 / 대상 아님 라벨]"),
  Para("조건 없음(어느 경로도 매칭 안 됨). 산출 블록 없음 — 안내문만 표시 (예: \"○○ 적용 대상이 아닙니다\")."),

  Heading("5. 경로별 리포트 구성  →  ④ 리포트 구성"),
  Note("각 경로마다 보여줄 카드를 직접 채웁니다. 아래 \"사용 가능한 종류(팔레트)\"에서 골라 경로별 표에 종류·바인딩·사이즈를 적으세요. 사이즈 = WxH(전체 폭 6). 배치 순서: fields → note → 나머지."),
  Menu("사용 가능한 카드 종류 (팔레트)"),
  Bullet("fields — 기본정보 묶음(성명·사번·부서·직급), 6x1   ·   note — 안내문/LLM 요약({변수명} 치환), 6x2   ·   card — 큰 숫자 카드, 2x2"),
  Bullet("chart(gauge) 원형진행 3x2  ·  chart(bullet) 실적vs목표 3x2  ·  chart(delta) 변화량 3x2  ·  chart(comparison) 이중막대 3x2"),
  Bullet("chart(stacked) 분류합계 6x2  ·  chart(bar/step) 구간표 6x2  ·  incexc 포함/제외 3x2  ·  compare 판정비교표(자동) 6x2"),
  Bold("경로 1 — [분류값1 또는 경로 라벨] 리포트  (팔레트에서 골라 채우기)"),
  Table(RPTP, [
    ["[예: fields]", "[성명·사번·부서·직급]", "[6x1]"],
    ["[예: note]", "[{LLM분석}]", "[6x2]"],
    ["[예: card]", "[핵심 산출 변수명]", "[2x2]"],
    ["[추가 카드…]", "[…]", "[…]"],
  ]),
  Bold("경로 2 — [분류값2 또는 경로 라벨] 리포트  (팔레트에서 골라 채우기)"),
  Table(RPTP, [
    ["[예: fields]", "[성명·사번·부서·직급]", "[6x1]"],
    ["[예: note]", "[{LLM분석}]", "[6x2]"],
    ["[예: card]", "[핵심 산출 변수명]", "[2x2]"],
  ]),
  Bold("Fallback — 미적용 리포트  (팔레트에서 골라 채우기)"),
  Table(RPTP, [
    ["[fields]", "[성명·사번·부서·직급]", "[6x1]"],
    ["[note]", "[미적용 안내문 · 예: 적용 대상이 아닙니다.]", "[6x2]"],
  ]),

  Heading("작성 팁"),
  Bullet("[대괄호]만 도메인에 맞게 채우면 됨. 빈 항목은 AI 가 자동 보완. 다중 경로 불필요하면 경로 1개 + Fallback 만."),
  Bullet("셀프 체크 — ① 각 경로의 진입조건이 명확? ② 케이스(분류값/구간)를 빠짐없이 경로로? ③ 변수명 문서 전체 일관?"),
];

const Spec = e(Document, null, e(Page, { size: "A4", style: S.page }, kids));
renderToFile(Spec, out).then(() => console.log("생성됨:", out));
