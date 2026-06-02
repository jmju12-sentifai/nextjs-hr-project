// 앱 기획서 샘플 PNG — "임금피크제 예시" (SAMPLE_WAGE_PEAK) 값으로 채움
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
import { execFileSync } from "node:child_process";
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
    padding: 26,
    fontFamily: "NotoKR",
    fontSize: 8.5,
    color: "#1f2937",
    lineHeight: 1.4,
  },
  titleWrap: {
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 7,
    borderBottom: "2px solid #1d4ed8",
  },
  title: { fontSize: 14, fontWeight: 700, color: "#1e3a8a" },
  subtitle: { fontSize: 9, color: "#475569", marginTop: 3 },

  sec: {
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    marginBottom: 7,
    overflow: "hidden",
  },
  secHead: {
    flexDirection: "row",
    backgroundColor: "#1e40af",
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  secBadge: {
    backgroundColor: "#fff",
    color: "#1e40af",
    fontSize: 9,
    fontWeight: 700,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 6,
  },
  secTitle: { color: "#fff", fontSize: 10, fontWeight: 700, flex: 1 },
  secNote: { color: "#cbd5e1", fontSize: 8 },
  secBody: { padding: 6, backgroundColor: "#fff" },

  tr: { flexDirection: "row", borderBottom: "1px solid #e2e8f0" },
  trHead: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  th: { padding: 3.5, fontSize: 8, fontWeight: 700, color: "#475569" },
  td: { padding: 3.5, fontSize: 8, color: "#1f2937" },

  row2: { flexDirection: "row", gap: 6 },
  col: { flex: 1 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 3,
  },
  box: {
    width: 9,
    height: 9,
    border: "1px solid #94a3b8",
    borderRadius: 1.5,
    marginRight: 4,
    backgroundColor: "#fff",
  },
  boxChk: {
    width: 9,
    height: 9,
    backgroundColor: "#1d4ed8",
    borderRadius: 1.5,
    marginRight: 4,
  },
  chipTxt: { fontSize: 8.5 },

  tagOk: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    fontSize: 7.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 3,
  },
  tagEx: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    fontSize: 7.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 3,
  },

  noteBox: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 3,
    padding: 6,
    fontSize: 8.5,
    color: "#1e3a8a",
    lineHeight: 1.5,
  },

  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 6,
    gap: 8,
  },
  btn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 700,
  },
  btnLight: {
    backgroundColor: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
  },
  btnAi: { backgroundColor: "#1d4ed8", color: "#fff" },
  btnNext: { backgroundColor: "#059669", color: "#fff" },
});

const Row = (cols, widths, isHead) =>
  React.createElement(
    View,
    { style: isHead ? S.trHead : S.tr },
    cols.map((c, i) =>
      React.createElement(
        Text,
        { key: i, style: [isHead ? S.th : S.td, { flex: widths[i] }] },
        String(c)
      )
    )
  );

const Section = (badge, title, note, children) =>
  React.createElement(
    View,
    { style: S.sec },
    React.createElement(View, { style: S.secHead }, [
      React.createElement(Text, { style: S.secBadge, key: "b" }, badge),
      React.createElement(Text, { style: S.secTitle, key: "t" }, title),
      note && React.createElement(Text, { style: S.secNote, key: "n" }, note),
    ]),
    React.createElement(View, { style: S.secBody }, children)
  );

const Chip = (label, checked, key) =>
  React.createElement(View, { style: S.chip, key }, [
    React.createElement(View, { style: checked ? S.boxChk : S.box, key: "x" }),
    React.createElement(Text, { style: S.chipTxt, key: "t" }, label),
  ]);

const Doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: "A4", style: S.page },

    React.createElement(View, { style: S.titleWrap }, [
      React.createElement(
        Text,
        { style: S.title, key: "t" },
        "임금피크제 자동화 마이크로 SaaS 앱 기획서"
      ),
      React.createElement(
        Text,
        { style: S.subtitle, key: "s" },
        "5개 탭 · 4개 구획 앱 사전 정의 양식 (예시값 채움)"
      ),
    ]),

    // 1탭 — 메타
    Section("1탭", "MSaaS 설명 · 앱 개요", "기획서 1탭에 해당", [
      Row(["구분", "내용"], [1, 5], true),
      Row(["앱 명", "임금피크제 자동화 마이크로 SaaS 앱"], [1, 5]),
      Row(
        ["서비스 한 줄 설명", "1명의 임직원 정보를 파싱하여 임금피크제 적용 여부와 수준, 시기 등을 도출하고 적용합니다."],
        [1, 5]
      ),
      Row(
        ["구축 목적", "임금피크제 적용에 필요한 기준 정보와 개인 데이터를 자동 처리하여 적용 여부·시기·수준·산출·안내까지 전 과정을 자동화"],
        [1, 5]
      ),
      Row(
        ["해결하려는 문제", "규정 해석과 개인별 적용 판단을 수작업으로 하면 시간이 많이 들고 오류·일관성 문제가 큼"],
        [1, 5]
      ),
      Row(["대상 사용자", "HR 운영팀 · 보상 담당자"], [1, 5]),
      Row(
        ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반"],
        [1, 5]
      ),
      Row(
        ["기대 효과", "업무 시간 90% 절감 / 자동 처리로 오류 최소화 / 컴플라이언스 강화"],
        [1, 5]
      ),
      Row(
        ["핵심 특징", "모듈형 마이크로 SaaS · 닫힌 문법 결정론 계산(LLM 미사용) · 1명 샘플 테스트"],
        [1, 5]
      ),
    ]),

    // 2탭 + 3탭 — 변수
    React.createElement(View, { style: S.row2 }, [
      React.createElement(
        View,
        { style: S.col, key: "l" },
        Section("2탭", "기준 지식화 · 규정 변수", null, [
          Row(["변수명", "타입", "단위", "예시값"], [2.5, 1, 0.8, 1.7], true),
          Row(["운영모델", "text", "—", "혼합형"], [2.5, 1, 0.8, 1.7]),
          Row(["최초적용연령", "number", "년", "56"], [2.5, 1, 0.8, 1.7]),
          Row(["최저임금월액", "number", "원", "2,060,000"], [2.5, 1, 0.8, 1.7]),
          Row(["기준일", "date", "—", "2025-07-01"], [2.5, 1, 0.8, 1.7]),
        ])
      ),
      React.createElement(
        View,
        { style: S.col, key: "r" },
        Section("3탭", "개인 정보 · 개인 변수", null, [
          Row(["변수명", "타입", "필수", "예시값"], [2, 1.2, 0.7, 2], true),
          Row(["성명", "text", "필수", "홍길동"], [2, 1.2, 0.7, 2]),
          Row(["사번", "text", "필수", "20142563"], [2, 1.2, 0.7, 2]),
          Row(["소속", "text", "선택", "렌탈사업부"], [2, 1.2, 0.7, 2]),
          Row(["직급", "text", "선택", "부장"], [2, 1.2, 0.7, 2]),
          Row(["생년월일", "date", "필수", "1967-03-26"], [2, 1.2, 0.7, 2]),
          Row(["기본급", "number(원)", "필수", "5,500,000"], [2, 1.2, 0.7, 2]),
          Row(["직책수당", "number(원)", "필수", "200,000"], [2, 1.2, 0.7, 2]),
          Row(["분기상여", "number(원)", "선택", "500,000"], [2, 1.2, 0.7, 2]),
        ])
      ),
    ]),

    // 4탭 — 분석 로직
    Section("4탭", "적용/미적용 분기 · 산출부 정의", null, [
      React.createElement(
        Text,
        { style: { fontSize: 8.5, fontWeight: 700, marginBottom: 2 } },
        "판정부 (모두 충족 → 적용 대상)"
      ),
      React.createElement(
        Text,
        { style: { fontSize: 8.5, color: "#334155", marginBottom: 4 } },
        "• 최초적용연령 ≤ 만나이"
      ),
      React.createElement(
        Text,
        { style: { fontSize: 8.5, fontWeight: 700, marginBottom: 2 } },
        "산출 블록 (위→아래 순)"
      ),
      Row(["#", "타입", "결과변수", "내용", "단위"], [0.3, 1, 1.3, 4, 0.5], true),
      Row(
        ["1", "날짜(diff)", "만나이", "생년월일 → 기준일 차이", "년"],
        [0.3, 1, 1.3, 4, 0.5]
      ),
      Row(
        ["2", "날짜(part)", "출생월", "생년월일에서 월 추출", "월"],
        [0.3, 1, 1.3, 4, 0.5]
      ),
      Row(
        ["3", "분기", "적용시점", "출생월 ≤ 6 → 당해 7/1, 아니면 익년 1/1", "—"],
        [0.3, 1, 1.3, 4, 0.5]
      ),
      Row(
        ["4", "분류(sum)", "통상임금기준액", "기본급 + 직책수당 (분기상여 제외)", "원"],
        [0.3, 1, 1.3, 4, 0.5]
      ),
      Row(
        ["5", "구간표", "감액률", "만나이: 56–57=0 · 58=20% · 59=30% · 60–65=35%", "%"],
        [0.3, 1, 1.3, 4, 0.5]
      ),
      Row(
        ["6", "계산식", "적용후월기준액", "통상임금기준액 × (1 − 감액률)", "원"],
        [0.3, 1, 1.3, 4, 0.5]
      ),
      Row(
        ["7", "보정", "최종월기준액", "적용후월기준액 을 최저임금월액 이상으로 보정", "원"],
        [0.3, 1, 1.3, 4, 0.5]
      ),
    ]),

    // 5탭 — 리포트 구성
    Section("5탭", "리포트 구성 · 안내문", "팔레트 8종 중 선택", [
      React.createElement(
        View,
        { style: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 } },
        [
          Chip("기본정보 (성명/사번)", true, "c1"),
          Chip("요약 카드 × 4", true, "c2"),
          Chip("판단 근거 비교표", true, "c3"),
          Chip("산출 근거 (적용후월기준액)", true, "c4"),
          Chip("포함/제외 태그 (통상임금기준액)", true, "c5"),
          Chip("구간 막대", false, "c6"),
          Chip("구간 계단선 (연령별 감액률)", true, "c7"),
          Chip("포함/제외 도넛 (통상임금)", true, "c8"),
          Chip("안내문", true, "c9"),
        ]
      ),
      React.createElement(
        View,
        { style: S.noteBox },
        React.createElement(
          Text,
          null,
          "안내문 템플릿 — {성명}({사번}) 님은 {운영모델} 기준 {적용여부}입니다. 만 {만나이} 기준 {적용시점}부터 적용되며 감액률 {감액률} 반영, 최종 월기준액 {최종월기준액}."
        )
      ),
    ]),

    React.createElement(View, { style: S.actionRow }, [
      React.createElement(Text, { style: [S.btn, S.btnLight], key: "1" }, "임시 저장"),
      React.createElement(Text, { style: [S.btn, S.btnAi], key: "2" }, "✦ AI 기획서 초안 추천"),
      React.createElement(Text, { style: [S.btn, S.btnNext], key: "3" }, "다음 단계로 이동 →"),
    ])
  )
);

await fs.mkdir(outDir, { recursive: true });
const pdfPath = path.join(outDir, "spec-form-sample2.pdf");
const pngPath = path.join(outDir, "spec-form-sample2.png");

await renderToFile(Doc, pdfPath);
console.log("✓ PDF:", path.relative(process.cwd(), pdfPath));

execFileSync(
  "sips",
  ["-s", "format", "png", "-Z", "1600", pdfPath, "--out", pngPath],
  { stdio: "inherit" }
);
console.log("✓ PNG:", path.relative(process.cwd(), pngPath));
