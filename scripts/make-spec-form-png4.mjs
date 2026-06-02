// 직군별 4경로 임금피크제 기획서 — 사무직/생산직/계약직/해당없음
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
    padding: 22,
    fontFamily: "NotoKR",
    fontSize: 8,
    color: "#1f2937",
    lineHeight: 1.4,
  },
  titleWrap: {
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 5,
    borderBottom: "2px solid #1d4ed8",
  },
  title: { fontSize: 13, fontWeight: 700, color: "#1e3a8a" },
  subtitle: { fontSize: 8.5, color: "#475569", marginTop: 2 },

  sec: { border: "1px solid #cbd5e1", borderRadius: 4, marginBottom: 6, overflow: "hidden" },
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
  th: { padding: 3, fontSize: 8, fontWeight: 700, color: "#475569" },
  td: { padding: 3, fontSize: 8, color: "#1f2937" },

  row2: { flexDirection: "row", gap: 6 },
  col: { flex: 1 },

  pathBox: {
    border: "1px solid #cbd5e1",
    borderRadius: 3,
    marginBottom: 5,
    overflow: "hidden",
  },
  pathHead: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
    paddingHorizontal: 7,
  },
  pathBadge: {
    fontSize: 8,
    fontWeight: 700,
    color: "#fff",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 6,
  },
  pathTitle: { fontSize: 9.5, fontWeight: 700, flex: 1 },
  pathConds: { fontSize: 8, color: "#475569" },
  pathBody: { paddingHorizontal: 6, paddingBottom: 4 },

  chip: { flexDirection: "row", alignItems: "center", marginRight: 8, marginBottom: 3 },
  box: { width: 9, height: 9, border: "1px solid #94a3b8", borderRadius: 1.5, marginRight: 4, backgroundColor: "#fff" },
  boxChk: { width: 9, height: 9, backgroundColor: "#1d4ed8", borderRadius: 1.5, marginRight: 4 },
  chipTxt: { fontSize: 8.5 },

  noteBox: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 3,
    padding: 5,
    fontSize: 8,
    color: "#1e3a8a",
    lineHeight: 1.5,
  },

  actionRow: { flexDirection: "row", justifyContent: "center", marginTop: 5, gap: 8 },
  btn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 4, fontSize: 9, fontWeight: 700 },
  btnLight: { backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" },
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

const PathCard = (color, badge, title, conds, body) =>
  React.createElement(View, { style: S.pathBox }, [
    React.createElement(
      View,
      { style: [S.pathHead, { backgroundColor: color.bg }], key: "h" },
      [
        React.createElement(
          Text,
          { style: [S.pathBadge, { backgroundColor: color.badge }], key: "b" },
          badge
        ),
        React.createElement(Text, { style: S.pathTitle, key: "t" }, title),
        React.createElement(Text, { style: S.pathConds, key: "c" }, conds),
      ]
    ),
    React.createElement(View, { style: S.pathBody, key: "bd" }, body),
  ]);

const Doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: [595, 1300], style: S.page },

    React.createElement(View, { style: S.titleWrap }, [
      React.createElement(
        Text,
        { style: S.title, key: "t" },
        "직군별 임금피크제 자동화 마이크로 SaaS 앱 기획서"
      ),
      React.createElement(
        Text,
        { style: S.subtitle, key: "s" },
        "공통 사전 계산 + 다중 경로 (사무직 / 생산직 / 계약직 / 해당없음, first-match)"
      ),
    ]),

    // 1탭 — 메타
    Section("1탭", "앱 개요", "MSaaS 설명 · 리포트 머리글", [
      Row(["구분", "내용"], [1, 5], true),
      Row(["앱 명", "직군별 임금피크제 자동화 마이크로 SaaS 앱"], [1, 5]),
      Row(
        ["한 줄 설명", "직군과 연령에 따라 임금피크제 적용 여부·감액률을 자동 판정합니다."],
        [1, 5]
      ),
      Row(
        ["구축 목적", "사무직/생산직별 다른 감액 기준을 일괄 자동화 처리, 계약직 제외 판정 포함"],
        [1, 5]
      ),
      Row(["대상 사용자", "HR 운영팀 · 보상 담당자"], [1, 5]),
      Row(
        ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 클라우드 기반"],
        [1, 5]
      ),
      Row(
        ["기대 효과", "직군별 다른 산식 자동 적용 · 수작업 오류 제거 · 일관성 강화"],
        [1, 5]
      ),
    ]),

    // 2탭 + 3탭 — 변수
    React.createElement(View, { style: S.row2 }, [
      React.createElement(
        View,
        { style: S.col, key: "l" },
        Section("2탭", "규정 변수", null, [
          Row(["변수명", "타입", "단위", "예시값"], [2.5, 1, 0.8, 1.7], true),
          Row(["사무직시작연령", "number", "년", "55"], [2.5, 1, 0.8, 1.7]),
          Row(["생산직시작연령", "number", "년", "57"], [2.5, 1, 0.8, 1.7]),
          Row(["정년", "number", "년", "60"], [2.5, 1, 0.8, 1.7]),
          Row(["최저임금월액", "number", "원", "2,060,000"], [2.5, 1, 0.8, 1.7]),
          Row(["기준일", "date", "—", "2025-07-01"], [2.5, 1, 0.8, 1.7]),
        ])
      ),
      React.createElement(
        View,
        { style: S.col, key: "r" },
        Section("3탭", "개인 변수", null, [
          Row(["변수명", "타입", "필수", "예시값"], [2, 1.2, 0.7, 2], true),
          Row(["성명", "text", "필수", "홍길동"], [2, 1.2, 0.7, 2]),
          Row(["사번", "text", "필수", "20142563"], [2, 1.2, 0.7, 2]),
          Row(["직군", "text", "필수", "사무직"], [2, 1.2, 0.7, 2]),
          Row(["생년월일", "date", "필수", "1968-03-26"], [2, 1.2, 0.7, 2]),
          Row(["기본급", "number(원)", "필수", "5,500,000"], [2, 1.2, 0.7, 2]),
          Row(["직책수당", "number(원)", "선택", "200,000"], [2, 1.2, 0.7, 2]),
          Row(["분기상여", "number(원)", "선택", "500,000"], [2, 1.2, 0.7, 2]),
        ])
      ),
    ]),

    // 4탭 — 분석 로직 (4 경로)
    Section("4탭", "분석 로직 — 공통 + 4 경로 (first-match)", null, [
      // 공통
      PathCard(
        { bg: "#f1f5f9", badge: "#475569" },
        "공통",
        "▤ 공통 사전 계산 (모든 경로 진입 전 실행)",
        "",
        [
          Row(["#", "타입", "결과변수", "내용"], [0.4, 1.2, 1.4, 4], true),
          Row(["1", "날짜(diff)", "만나이", "생년월일 → 기준일 차이 (년)"], [0.4, 1.2, 1.4, 4]),
        ]
      ),

      // 경로 A
      PathCard(
        { bg: "#dbeafe", badge: "#1d4ed8" },
        "경로 A",
        "사무직 임금피크제 적용",
        "조건: 직군 == \"사무직\"  AND  만나이 >= 사무직시작연령(55)",
        [
          Row(["#", "타입", "결과변수", "내용"], [0.4, 1.2, 1.4, 4], true),
          Row(
            ["1", "분류(sum)", "통상임금기준액", "기본급 + 직책수당 (체크 항목 합계)"],
            [0.4, 1.2, 1.4, 4]
          ),
          Row(
            ["2", "구간표", "감액률", "만 55=10% · 만 56~57=20% · 만 58~정년=30%"],
            [0.4, 1.2, 1.4, 4]
          ),
          Row(
            ["3", "계산식", "적용후월기준액", "통상임금기준액 × (1 − 감액률)"],
            [0.4, 1.2, 1.4, 4]
          ),
          Row(
            ["4", "보정", "최종월기준액", "최저임금월액 이상으로 보정"],
            [0.4, 1.2, 1.4, 4]
          ),
        ]
      ),

      // 경로 B
      PathCard(
        { bg: "#dbeafe", badge: "#1d4ed8" },
        "경로 B",
        "생산직 임금피크제 적용",
        "조건: 직군 == \"생산직\"  AND  만나이 >= 생산직시작연령(57)",
        [
          Row(["#", "타입", "결과변수", "내용"], [0.4, 1.2, 1.4, 4], true),
          Row(
            ["1", "분류(sum)", "통상임금기준액", "기본급 + 직책수당 (체크 항목 합계)"],
            [0.4, 1.2, 1.4, 4]
          ),
          Row(
            ["2", "구간표", "감액률", "만 57=5% · 만 58=10% · 만 59~정년=15%"],
            [0.4, 1.2, 1.4, 4]
          ),
          Row(
            ["3", "계산식", "적용후월기준액", "통상임금기준액 × (1 − 감액률)"],
            [0.4, 1.2, 1.4, 4]
          ),
          Row(
            ["4", "보정", "최종월기준액", "최저임금월액 이상으로 보정"],
            [0.4, 1.2, 1.4, 4]
          ),
        ]
      ),

      // 경로 C
      PathCard(
        { bg: "#fef3c7", badge: "#b45309" },
        "경로 C",
        "계약직 적용 제외",
        ' 조건: 직군 == "계약직"',
        [
          React.createElement(
            Text,
            { style: { fontSize: 8, color: "#78350f" } },
            "산출 블록 없음 — 안내문만 표시 (\"계약직은 임금피크제 적용 대상이 아닙니다\")"
          ),
        ]
      ),

      // fallback (경로 D)
      PathCard(
        { bg: "#fee2e2", badge: "#b91c1c" },
        "Fallback",
        "▣ 대상 아님 (경로 D)",
        "조건 없음 — 사무직/생산직 연령 미달 또는 기타 직군",
        [
          React.createElement(
            Text,
            { style: { fontSize: 8, color: "#7f1d1d" } },
            "산출 블록 없음 — 안내문만 표시 (\"현재 임금피크제 적용 대상이 아닙니다\")"
          ),
        ]
      ),
    ]),

    // 5탭 — 리포트 (경로별 다른 구성)
    Section("5탭", "경로별 리포트 구성", null, [
      React.createElement(
        Text,
        { style: { fontSize: 8.5, fontWeight: 700, marginBottom: 3, color: "#1d4ed8" } },
        "경로 A · 경로 B (적용 그룹)"
      ),
      React.createElement(
        View,
        { style: { flexDirection: "row", flexWrap: "wrap", marginBottom: 5 } },
        [
          Chip("기본정보 (성명/사번/직군)", true, "ca1"),
          Chip("요약 카드 (감액률/최종월기준액)", true, "ca2"),
          Chip("판단 근거 비교표", true, "ca3"),
          Chip("산출 근거 (적용후월기준액)", true, "ca4"),
          Chip("포함/제외 태그", true, "ca5"),
          Chip("구간 막대", false, "ca6"),
          Chip("구간 계단선 (연령별 감액률)", true, "ca7"),
          Chip("포함/제외 도넛", true, "ca8"),
          Chip("안내문 (직군별 다른 메시지)", true, "ca9"),
        ]
      ),

      React.createElement(
        Text,
        { style: { fontSize: 8.5, fontWeight: 700, marginBottom: 3, color: "#b45309" } },
        "경로 C (계약직 제외)"
      ),
      React.createElement(
        View,
        { style: { flexDirection: "row", flexWrap: "wrap", marginBottom: 5 } },
        [
          Chip("기본정보 (성명/사번/직군)", true, "cc1"),
          Chip("요약 카드", false, "cc2"),
          Chip("판단 근거 비교표", false, "cc3"),
          Chip("산출 근거", false, "cc4"),
          Chip("포함/제외 태그", false, "cc5"),
          Chip("구간 막대", false, "cc6"),
          Chip("구간 계단선", false, "cc7"),
          Chip("포함/제외 도넛", false, "cc8"),
          Chip("안내문 (계약직 제외 사유)", true, "cc9"),
        ]
      ),

      React.createElement(
        Text,
        { style: { fontSize: 8.5, fontWeight: 700, marginBottom: 3, color: "#b91c1c" } },
        "Fallback (대상 아님)"
      ),
      React.createElement(
        View,
        { style: { flexDirection: "row", flexWrap: "wrap", marginBottom: 5 } },
        [
          Chip("기본정보 (성명/사번/직군/만나이)", true, "cf1"),
          Chip("안내문 (대상 아님 사유)", true, "cf2"),
        ]
      ),

      React.createElement(
        View,
        { style: S.noteBox },
        React.createElement(
          Text,
          null,
          "경로별 안내문 — 경로 A: \"{성명} 님은 사무직 임금피크제 대상입니다. 감액률 {감액률} 적용...\" / 경로 B: \"생산직 임금피크제 대상입니다...\" / 경로 C: \"계약직은 적용 대상이 아닙니다.\" / Fallback: \"현재 적용 대상이 아닙니다. 만 {만나이}세 / 직군 {직군}\""
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
const pdfPath = path.join(outDir, "spec-wagepeak-by-job.pdf");
const pngPath = path.join(outDir, "spec-wagepeak-by-job.png");

await renderToFile(Doc, pdfPath);
console.log("✓ PDF:", path.relative(process.cwd(), pdfPath));

execFileSync("sips", ["-s", "format", "png", "-Z", "1800", pdfPath, "--out", pngPath], {
  stdio: "inherit",
});
console.log("✓ PNG:", path.relative(process.cwd(), pngPath));
