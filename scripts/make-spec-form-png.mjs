// 앱 기획서 1페이지 샘플 폼 PNG 생성
// 1) @react-pdf/renderer 로 단일 페이지 PDF 작성
// 2) macOS sips 로 PNG 변환
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
    padding: 28,
    fontFamily: "NotoKR",
    fontSize: 9,
    color: "#1f2937",
    lineHeight: 1.4,
  },
  titleWrap: {
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "2px solid #1d4ed8",
  },
  title: { fontSize: 14.5, fontWeight: 700, color: "#1e3a8a" },
  subtitle: { fontSize: 9, color: "#475569", marginTop: 3 },

  sec: {
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    marginBottom: 8,
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

  // table
  tr: { flexDirection: "row", borderBottom: "1px solid #e2e8f0" },
  trHead: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  th: {
    padding: 4,
    fontSize: 8.5,
    fontWeight: 700,
    color: "#475569",
  },
  td: { padding: 4, fontSize: 8.5, color: "#1f2937" },

  // grid 2-col
  row2: { flexDirection: "row", gap: 6 },
  col: { flex: 1 },

  // checklist
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

  // note box
  noteBox: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 3,
    padding: 6,
    fontSize: 8.5,
    color: "#1e3a8a",
    lineHeight: 1.5,
  },

  // 하단 액션
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
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
  btnAi: {
    backgroundColor: "#1d4ed8",
    color: "#fff",
  },
  btnNext: {
    backgroundColor: "#059669",
    color: "#fff",
  },
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

const Chip = (label, checked) =>
  React.createElement(View, { style: S.chip }, [
    React.createElement(View, { style: checked ? S.boxChk : S.box, key: "x" }),
    React.createElement(Text, { style: S.chipTxt, key: "t" }, label),
  ]);

const Doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: "A4", style: S.page },

    // 타이틀
    React.createElement(View, { style: S.titleWrap }, [
      React.createElement(
        Text,
        { style: S.title, key: "t" },
        "임금피크제 자동화 마이크로 SaaS 앱 기획서"
      ),
      React.createElement(
        Text,
        { style: S.subtitle, key: "s" },
        "5개 탭 · 4개 구획 앱 사전 정의 양식"
      ),
    ]),

    // 1탭 — 앱 개요
    Section("1탭", "MSaaS 설명 · 앱 개요 기획 항목", "메타 정보", [
      Row(["구분", "내용"], [1, 5], true),
      Row(["앱 명", "임금피크제 자동화 마이크로 SaaS 앱"], [1, 5]),
      Row(
        ["서비스 한 줄 설명", "1명의 임직원 정보를 파싱하여 임금피크제 적용 여부·수준·시기를 자동 산출"],
        [1, 5]
      ),
      Row(
        ["구축 목적", "규정 해석과 개인 판정을 자동화하여 정확도·일관성·속도 확보"],
        [1, 5]
      ),
      Row(["해결하려는 문제", "수작업 산정 시 오류·일관성·시간 비용"], [1, 5]),
      Row(["대상 사용자", "HR 운영팀 · 보상 담당자"], [1, 5]),
      Row(["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반"], [1, 5]),
    ]),

    // 2탭 + 3탭 — 변수 (2단)
    React.createElement(View, { style: S.row2 }, [
      React.createElement(
        View,
        { style: S.col, key: "l" },
        Section("2탭", "기준 지식화 · 규정 변수", null, [
          Row(["변수명", "타입", "단위"], [3, 1.2, 1], true),
          Row(["최초적용연령", "number", "년"], [3, 1.2, 1]),
          Row(["최저임금월액", "number", "원"], [3, 1.2, 1]),
          Row(["기준일", "date", "—"], [3, 1.2, 1]),
          Row(["운영모델", "text", "—"], [3, 1.2, 1]),
          Row(["감액률단계", "number", "%"], [3, 1.2, 1]),
        ])
      ),
      React.createElement(
        View,
        { style: S.col, key: "r" },
        Section("3탭", "개인 정보 항목 · 개인 변수", null, [
          Row(["변수명", "타입", "필수"], [3, 1.2, 1], true),
          Row(["성명", "text", "필수"], [3, 1.2, 1]),
          Row(["사번", "text", "필수"], [3, 1.2, 1]),
          Row(["생년월일", "date", "필수"], [3, 1.2, 1]),
          Row(["기본급", "number(원)", "필수"], [3, 1.2, 1]),
          Row(["직책수당", "number(원)", "선택"], [3, 1.2, 1]),
        ])
      ),
    ]),

    // 4탭 — 분석 로직
    Section("4탭", "적용/미적용 분기 · 산출부 정의", null, [
      React.createElement(
        Text,
        { style: { fontSize: 8.5, fontWeight: 700, marginBottom: 3 } },
        "판정부 (모두 충족 → 적용 대상)"
      ),
      React.createElement(
        Text,
        { style: { fontSize: 8.5, color: "#334155", marginBottom: 4 } },
        "• 최초적용연령 ≤ 만나이"
      ),
      React.createElement(
        Text,
        { style: { fontSize: 8.5, fontWeight: 700, marginBottom: 3 } },
        "산출 블록 (위→아래 순)"
      ),
      Row(["#", "타입", "결과변수", "내용"], [0.4, 1.2, 1.4, 4], true),
      Row(["1", "날짜(diff)", "만나이", "생년월일 → 기준일 차이 (년)"], [0.4, 1.2, 1.4, 4]),
      Row(["2", "분류(sum)", "통상임금", "기본급 + 직책수당 (체크)"], [0.4, 1.2, 1.4, 4]),
      Row(["3", "구간표", "감액률", "만나이 → 단계별 감액률(%)"], [0.4, 1.2, 1.4, 4]),
      Row(["4", "계산식", "피크임금", "통상임금 × (1 − 감액률)"], [0.4, 1.2, 1.4, 4]),
      Row(["5", "보정", "최종임금", "피크임금 ≥ 최저임금월액 보정"], [0.4, 1.2, 1.4, 4]),
    ]),

    // 5탭 — 리포트 구성 (체크리스트 + 안내)
    Section("5탭", "리포트 구성 · 안내문", "팔레트 8종 중 선택", [
      React.createElement(
        View,
        { style: { flexDirection: "row", flexWrap: "wrap" } },
        [
          Chip("기본정보", true),
          Chip("요약 카드", true),
          Chip("판단 근거 비교표", true),
          Chip("산출 근거", true),
          Chip("포함/제외 태그", true),
          Chip("구간 막대", false),
          Chip("구간 계단선", true),
          Chip("포함/제외 도넛", false),
          Chip("안내문", true),
        ]
      ),
      React.createElement(
        View,
        { style: [S.noteBox, { marginTop: 6 }] },
        React.createElement(
          Text,
          null,
          "안내문 템플릿 — {성명}({사번}) 님은 {적용여부}이며, 만 {만나이} 기준 감액률 {감액률} 적용, 최종 월기준액 {최종임금}입니다."
        )
      ),
    ]),

    // 하단 액션바
    React.createElement(View, { style: S.actionRow }, [
      React.createElement(Text, { style: [S.btn, S.btnLight], key: "1" }, "임시 저장"),
      React.createElement(Text, { style: [S.btn, S.btnAi], key: "2" }, "✦ AI 기획서 초안 추천"),
      React.createElement(Text, { style: [S.btn, S.btnNext], key: "3" }, "다음 단계로 이동 →"),
    ])
  )
);

await fs.mkdir(outDir, { recursive: true });
const pdfPath = path.join(outDir, "spec-form-sample.pdf");
const pngPath = path.join(outDir, "spec-form-sample.png");

await renderToFile(Doc, pdfPath);
console.log("✓ PDF:", path.relative(process.cwd(), pdfPath));

// sips PDF → PNG (300dpi 효과를 위해 폭 1200px)
execFileSync(
  "sips",
  ["-s", "format", "png", "-Z", "1600", pdfPath, "--out", pngPath],
  { stdio: "inherit" }
);
console.log("✓ PNG:", path.relative(process.cwd(), pngPath));
