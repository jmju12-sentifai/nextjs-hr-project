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
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "samples");

// 한글 폰트 등록 (Noto Sans KR — Google Fonts CDN)
Font.register({
  family: "NotoKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
      fontWeight: 400,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: "NotoKR",
    fontSize: 11,
    lineHeight: 1.6,
  },
  h1: { fontSize: 18, marginBottom: 16, fontWeight: 700 },
  h2: { fontSize: 13, marginTop: 14, marginBottom: 6, fontWeight: 700 },
  p: { marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 130, color: "#555" },
  value: { flex: 1 },
  table: { border: "1px solid #999", marginTop: 6 },
  tr: { flexDirection: "row", borderBottom: "1px solid #ccc" },
  th: { flex: 1, padding: 6, backgroundColor: "#f0f0f0", fontWeight: 700 },
  td: { flex: 1, padding: 6 },
});

// ───────────────────────── 규정 문서 ─────────────────────────
const RegulationDoc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: "A4", style: styles.page },
    React.createElement(Text, { style: styles.h1 }, "주식회사 ○○ 임금피크제 운영 규정"),
    React.createElement(
      Text,
      { style: styles.p },
      "본 규정은 정년 도래 근로자의 고용 안정과 회사의 인건비 부담 완화를 위해 임금피크제를 운영함에 관한 사항을 정한다."
    ),
    React.createElement(Text, { style: styles.h2 }, "제1조 (정년 및 적용 시점)"),
    React.createElement(Text, { style: styles.p }, "① 본 회사의 정년은 만 60세로 한다."),
    React.createElement(
      Text,
      { style: styles.p },
      "② 임금피크제는 만 55세에 도달한 해의 다음 임금 협상일부터 적용한다."
    ),
    React.createElement(
      Text,
      { style: styles.p },
      "③ 임금피크제 적용 기간은 총 5년으로 한다."
    ),

    React.createElement(Text, { style: styles.h2 }, "제2조 (연차별 감액률)"),
    React.createElement(
      Text,
      { style: styles.p },
      "임금피크제 적용 대상자의 기본임금 감액률은 다음과 같다."
    ),
    React.createElement(View, { style: styles.table }, [
      React.createElement(View, { style: styles.tr, key: "h" }, [
        React.createElement(Text, { style: styles.th, key: "a" }, "구분"),
        React.createElement(Text, { style: styles.th, key: "b" }, "감액률"),
      ]),
      ...[
        ["1년차 (정년까지 5년 남음)", "10%"],
        ["2년차 (정년까지 4년 남음)", "20%"],
        ["3년차 (정년까지 3년 남음)", "30%"],
        ["4년차 (정년까지 2년 남음)", "40%"],
        ["5년차 (정년까지 1년 남음)", "50%"],
      ].map(([k, v], i) =>
        React.createElement(View, { style: styles.tr, key: i }, [
          React.createElement(Text, { style: styles.td, key: "a" }, k),
          React.createElement(Text, { style: styles.td, key: "b" }, v),
        ])
      ),
    ]),

    React.createElement(Text, { style: styles.h2 }, "제3조 (요약)"),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "정년"),
      React.createElement(Text, { style: styles.value, key: "v" }, "60년"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "피크시작연령"),
      React.createElement(Text, { style: styles.value, key: "v" }, "55년"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "피크기간"),
      React.createElement(Text, { style: styles.value, key: "v" }, "5년"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "1년차감액률"),
      React.createElement(Text, { style: styles.value, key: "v" }, "10%"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "2년차감액률"),
      React.createElement(Text, { style: styles.value, key: "v" }, "20%"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "3년차감액률"),
      React.createElement(Text, { style: styles.value, key: "v" }, "30%"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "4년차감액률"),
      React.createElement(Text, { style: styles.value, key: "v" }, "40%"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "5년차감액률"),
      React.createElement(Text, { style: styles.value, key: "v" }, "50%"),
    ])
  )
);

// ───────────────────────── 개인 문서 (인사기록카드) ─────────────────────────
const PersonalDoc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: "A4", style: styles.page },
    React.createElement(Text, { style: styles.h1 }, "인사기록카드"),
    React.createElement(
      Text,
      { style: styles.p },
      "본 문서는 임금피크제 적용 분석을 위한 개인 정보를 포함합니다."
    ),
    React.createElement(Text, { style: styles.h2 }, "1. 인적 사항"),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "성명"),
      React.createElement(Text, { style: styles.value, key: "v" }, "홍길동"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "생년월일"),
      React.createElement(Text, { style: styles.value, key: "v" }, "1969-03-15"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "사원번호"),
      React.createElement(Text, { style: styles.value, key: "v" }, "EMP-19930402"),
    ]),

    React.createElement(Text, { style: styles.h2 }, "2. 재직 정보"),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "입사일"),
      React.createElement(Text, { style: styles.value, key: "v" }, "1993-04-02"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "직군"),
      React.createElement(Text, { style: styles.value, key: "v" }, "사무직 (관리)"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "직급"),
      React.createElement(Text, { style: styles.value, key: "v" }, "부장"),
    ]),

    React.createElement(Text, { style: styles.h2 }, "3. 임금 정보"),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "현재기본임금"),
      React.createElement(Text, { style: styles.value, key: "v" }, "7,000,000원 (월)"),
    ]),
    React.createElement(View, { style: styles.row }, [
      React.createElement(Text, { style: styles.label, key: "l" }, "최근 인상일"),
      React.createElement(Text, { style: styles.value, key: "v" }, "2025-01-01"),
    ]),

    React.createElement(Text, { style: styles.h2 }, "4. 임금피크제 적용 안내"),
    React.createElement(
      Text,
      { style: styles.p },
      "본 직원은 만 57세로 회사 임금피크제 적용 대상에 해당하며, 정년까지 3년이 남았습니다 (정년 60세)."
    ),
    React.createElement(
      Text,
      { style: styles.p },
      "당해연도(3년차) 감액률은 30%이며, 적용 임금은 4,900,000원으로 예상됩니다."
    ),

    React.createElement(Text, { style: styles.p }, " "),
    React.createElement(
      Text,
      { style: styles.p },
      "본 문서의 정보는 임금피크제 적용 분석 목적으로만 사용됩니다."
    )
  )
);

const fs = await import("node:fs/promises");
await fs.mkdir(outDir, { recursive: true });

await renderToFile(RegulationDoc, path.join(outDir, "regulation.pdf"));
console.log("✓ samples/regulation.pdf");

await renderToFile(PersonalDoc, path.join(outDir, "personal.pdf"));
console.log("✓ samples/personal.pdf");
