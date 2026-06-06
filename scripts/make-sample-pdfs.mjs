// 사용자 앱에서 업로드 샘플로 쓰는 PDF 2종 생성
//   - public/samples/임금피크제_운영세칙_샘플.pdf  (규정/기준 지식화용)
//   - public/samples/홍길동_인사정보_샘플.pdf       (개인정보 파싱용)
//
// 실행: node scripts/make-sample-pdfs.mjs

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
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "samples");

Font.register({
  family: "NotoKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
      fontWeight: 700,
    },
  ],
});

const S = StyleSheet.create({
  page: {
    padding: 44,
    fontFamily: "NotoKR",
    fontSize: 11,
    lineHeight: 1.55,
    color: "#1f2937",
  },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 11, color: "#6b7280", marginBottom: 18 },
  h2: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 8,
    color: "#1d4ed8",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 4,
  },
  h3: { fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 120, color: "#4b5563" },
  value: { flex: 1, fontWeight: 700 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bDot: { width: 12 },
  table: {
    border: "1px solid #d1d5db",
    borderRadius: 4,
    marginTop: 6,
    marginBottom: 6,
  },
  trH: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: "1px solid #d1d5db",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: "1px solid #e5e7eb",
  },
  th: { fontWeight: 700, fontSize: 10.5 },
  td: { fontSize: 10.5 },
  note: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    fontSize: 10,
    color: "#78350f",
  },
});

const h = React.createElement;

// ──────────────────────────────────────────────────────────────
// PDF 1) 임금피크제 운영 세칙 — 규정/기준 지식화용
// 추출 대상 변수:
//   운영모델 (text)         → "혼합형"
//   최초적용연령 (number)   → 56
//   정년 (number)           → 60
//   최저임금월액 (number)   → 2,060,000원
//   기준일 (date)           → 2025-07-01
// ──────────────────────────────────────────────────────────────

const RegDoc = h(
  Document,
  null,
  h(
    Page,
    { size: "A4", style: S.page },
    h(Text, { style: S.title }, "임금피크제 운영 세칙"),
    h(
      Text,
      { style: S.sub },
      "주식회사 케이프라임연구소 · 인사규정 부속서 제3호 (2025년 개정)"
    ),

    h(Text, { style: S.h2 }, "제1조 (목적)"),
    h(
      Text,
      { style: S.p },
      "본 세칙은 임직원의 정년 연장 및 고용 안정을 위하여 임금피크제의 운영기준·적용연령·감액기준 등 세부사항을 규정함을 목적으로 한다."
    ),

    h(Text, { style: S.h2 }, "제2조 (용어 및 운영기준)"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "운영모델"),
      h(
        Text,
        { style: S.value, key: "v" },
        "혼합형 (가산형 + 표준형 병행 운영)"
      ),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "최초적용연령"),
      h(Text, { style: S.value, key: "v" }, "만 56년 (만 56세 도달일 익월)"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "정년"),
      h(Text, { style: S.value, key: "v" }, "만 60년"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "최저임금월액"),
      h(Text, { style: S.value, key: "v" }, "2,060,000원 (월 기준)"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "기준일"),
      h(Text, { style: S.value, key: "v" }, "2025-07-01"),
    ]),

    h(Text, { style: S.h2 }, "제3조 (감액률)"),
    h(View, { style: S.table }, [
      h(View, { style: S.trH, key: "h" }, [
        h(Text, { style: [S.th, { width: 80 }], key: 1 }, "운영구분"),
        h(Text, { style: [S.th, { width: 90 }], key: 2 }, "적용연령"),
        h(Text, { style: [S.th, { width: 70 }], key: 3 }, "감액률"),
        h(Text, { style: [S.th, { flex: 1 }], key: 4 }, "비고"),
      ]),
      h(View, { style: S.tr, key: "r1" }, [
        h(Text, { style: [S.td, { width: 80 }], key: 1 }, "가산형"),
        h(Text, { style: [S.td, { width: 90 }], key: 2 }, "만 56~58세"),
        h(Text, { style: [S.td, { width: 70 }], key: 3 }, "20%"),
        h(
          Text,
          { style: [S.td, { flex: 1 }], key: 4 },
          "통상임금 산정월액 × 0.8"
        ),
      ]),
      h(View, { style: S.tr, key: "r2" }, [
        h(Text, { style: [S.td, { width: 80 }], key: 1 }, "표준형"),
        h(Text, { style: [S.td, { width: 90 }], key: 2 }, "만 59~정년"),
        h(Text, { style: [S.td, { width: 70 }], key: 3 }, "35%"),
        h(
          Text,
          { style: [S.td, { flex: 1 }], key: 4 },
          "통상임금 산정월액 × 0.65"
        ),
      ]),
    ]),

    h(Text, { style: S.h2 }, "제4조 (산정 원칙)"),
    h(
      Text,
      { style: S.p },
      "1. 월기준액은 기본급·직책수당·가족수당·식대·분기상여(1/3)의 합으로 산정한다."
    ),
    h(
      Text,
      { style: S.p },
      "2. 산정 결과가 최저임금월액 2,060,000원에 미달하는 경우 최저임금월액을 적용한다."
    ),
    h(
      Text,
      { style: S.p },
      "3. 감액률은 운영모델 및 적용연령 구간에 따라 본 세칙 제3조의 표를 적용한다."
    ),

    h(
      Text,
      { style: S.note },
      "※ 본 문서는 임금피크제 자동화 마이크로 SaaS 데모용 샘플입니다. 실제 인사규정이 아니며 시연 목적으로 작성되었습니다."
    )
  )
);

// ──────────────────────────────────────────────────────────────
// PDF 2) 홍길동 부장 인사정보 — 개인정보 파싱용
// 추출 대상 변수:
//   성명, 사번, 소속, 직급, 생년월일
//   기본급, 직책수당, 가족수당, 식대, 분기상여
//   전년기본급, 목표월기준액, 평가점수, 연차부여, 연차사용
// ──────────────────────────────────────────────────────────────

const PersonDoc = h(
  Document,
  null,
  h(
    Page,
    { size: "A4", style: S.page },
    h(Text, { style: S.title }, "임직원 인사·급여 정보"),
    h(
      Text,
      { style: S.sub },
      "발급일 2025-06-30 · 인사팀 · 임금피크제 적용 검토용"
    ),

    h(Text, { style: S.h2 }, "1. 기본 인적사항"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "성명"),
      h(Text, { style: S.value, key: "v" }, "홍길동"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "사번"),
      h(Text, { style: S.value, key: "v" }, "20142563"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "소속"),
      h(Text, { style: S.value, key: "v" }, "렌탈사업부"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "직급"),
      h(Text, { style: S.value, key: "v" }, "부장"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "생년월일"),
      h(Text, { style: S.value, key: "v" }, "1967-03-26"),
    ]),

    h(Text, { style: S.h2 }, "2. 통상임금 구성 (당월)"),
    h(View, { style: S.table }, [
      h(View, { style: S.trH, key: "h" }, [
        h(Text, { style: [S.th, { flex: 2 }], key: 1 }, "항목"),
        h(Text, { style: [S.th, { flex: 1, textAlign: "right" }], key: 2 }, "금액(원)"),
      ]),
      h(View, { style: S.tr, key: "r1" }, [
        h(Text, { style: [S.td, { flex: 2 }], key: 1 }, "기본급"),
        h(Text, { style: [S.td, { flex: 1, textAlign: "right" }], key: 2 }, "5,500,000"),
      ]),
      h(View, { style: S.tr, key: "r2" }, [
        h(Text, { style: [S.td, { flex: 2 }], key: 1 }, "직책수당"),
        h(Text, { style: [S.td, { flex: 1, textAlign: "right" }], key: 2 }, "200,000"),
      ]),
      h(View, { style: S.tr, key: "r3" }, [
        h(Text, { style: [S.td, { flex: 2 }], key: 1 }, "가족수당"),
        h(Text, { style: [S.td, { flex: 1, textAlign: "right" }], key: 2 }, "150,000"),
      ]),
      h(View, { style: S.tr, key: "r4" }, [
        h(Text, { style: [S.td, { flex: 2 }], key: 1 }, "식대"),
        h(Text, { style: [S.td, { flex: 1, textAlign: "right" }], key: 2 }, "100,000"),
      ]),
      h(View, { style: S.tr, key: "r5" }, [
        h(Text, { style: [S.td, { flex: 2 }], key: 1 }, "분기상여"),
        h(Text, { style: [S.td, { flex: 1, textAlign: "right" }], key: 2 }, "500,000"),
      ]),
    ]),

    h(Text, { style: S.h2 }, "3. 보상 기준·평가"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "전년기본급"),
      h(Text, { style: S.value, key: "v" }, "5,300,000원"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "목표월기준액"),
      h(Text, { style: S.value, key: "v" }, "5,800,000원"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "평가점수"),
      h(Text, { style: S.value, key: "v" }, "82점 (S~D 5단계 중 B등급)"),
    ]),

    h(Text, { style: S.h2 }, "4. 연차 현황"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "연차부여"),
      h(Text, { style: S.value, key: "v" }, "20일"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "연차사용"),
      h(Text, { style: S.value, key: "v" }, "12일"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "잔여연차"),
      h(Text, { style: S.value, key: "v" }, "8일"),
    ]),

    h(
      Text,
      { style: S.note },
      "※ 본 문서는 임금피크제 자동화 마이크로 SaaS 데모용 샘플입니다. 실재 인물의 정보가 아닌 가공 데이터입니다."
    )
  )
);

await fs.mkdir(outDir, { recursive: true });
await renderToFile(RegDoc, path.join(outDir, "임금피크제_운영세칙_샘플.pdf"));
await renderToFile(PersonDoc, path.join(outDir, "홍길동_인사정보_샘플.pdf"));

console.log("✓ 샘플 PDF 2종 생성 완료:");
console.log("  -", path.join(outDir, "임금피크제_운영세칙_샘플.pdf"));
console.log("  -", path.join(outDir, "홍길동_인사정보_샘플.pdf"));
