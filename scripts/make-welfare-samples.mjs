// 복리후생(경조사 지원) — 사용자 앱 테스트용 업로드 샘플 2종
//   public/samples/경조사지원_운영기준_샘플.pdf      (규정/기준 지식화용 — 1탭)
//   public/samples/김인사_경조사신청서_샘플.pdf      (개인정보 파싱용 — 2탭)
//
// 실행: node scripts/make-welfare-samples.mjs

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
  label: { width: 130, color: "#4b5563" },
  value: { flex: 1, fontWeight: 700 },
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
// PDF 1) 경조사지원 운영기준 — 규정/기준 지식화용 (1탭)
// 추출 대상 규정 변수:
//   사망조위금기준액  → 1,000,000원
//   결혼축의금기준액  → 500,000원
//   출산축하금기준액  → 300,000원
//   입학지원금기준액  → 200,000원
//   최대지원한도      → 2,000,000원
//   신청가능기한      → 60일
//   근속가산기준년수  → 5년
//   근속가산율        → 10%
//   기준일            → 2026-06-01
// ──────────────────────────────────────────────────────────────

const RegDoc = h(
  Document,
  null,
  h(
    Page,
    { size: "A4", style: S.page },
    h(Text, { style: S.title }, "복리후생 경조사 지원 운영기준"),
    h(
      Text,
      { style: S.sub },
      "주식회사 케이프라임연구소 · 인사규정 부속서 제5호 (2026년 개정)"
    ),

    h(Text, { style: S.h2 }, "제1조 (목적)"),
    h(
      Text,
      { style: S.p },
      "본 운영기준은 임직원의 경조사에 대한 지원금 지급 기준·관계별 지급 비율·신청 기한 등을 정함을 목적으로 한다."
    ),

    h(Text, { style: S.h2 }, "제2조 (지원금 기준액)"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "사망조위금기준액"),
      h(Text, { style: S.value, key: "v" }, "1,000,000원 (1건 기준)"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "결혼축의금기준액"),
      h(Text, { style: S.value, key: "v" }, "500,000원"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "출산축하금기준액"),
      h(Text, { style: S.value, key: "v" }, "300,000원"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "입학지원금기준액"),
      h(Text, { style: S.value, key: "v" }, "200,000원 (자녀 1인당)"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "최대지원한도"),
      h(Text, { style: S.value, key: "v" }, "2,000,000원 (1건 한도)"),
    ]),

    h(Text, { style: S.h2 }, "제3조 (신청 기한)"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "신청가능기한"),
      h(Text, { style: S.value, key: "v" }, "60일 (발생일로부터)"),
    ]),
    h(
      Text,
      { style: S.p },
      "발생일로부터 60일이 경과한 신청은 원칙적으로 지원 대상에서 제외한다."
    ),

    h(Text, { style: S.h2 }, "제4조 (관계별 지원 비율 — 사망조위)"),
    h(View, { style: S.table }, [
      h(View, { style: S.trH, key: "h" }, [
        h(Text, { style: [S.th, { width: 90 }], key: 1 }, "분류"),
        h(Text, { style: [S.th, { width: 130 }], key: 2 }, "관계 범위"),
        h(Text, { style: [S.th, { width: 70 }], key: 3 }, "지급 비율"),
        h(Text, { style: [S.th, { flex: 1 }], key: 4 }, "비고"),
      ]),
      h(View, { style: S.tr, key: "r1" }, [
        h(Text, { style: [S.td, { width: 90 }], key: 1 }, "직계"),
        h(Text, { style: [S.td, { width: 130 }], key: 2 }, "배우자·부모·자녀"),
        h(Text, { style: [S.td, { width: 70 }], key: 3 }, "100%"),
        h(Text, { style: [S.td, { flex: 1 }], key: 4 }, "기준액 전액"),
      ]),
      h(View, { style: S.tr, key: "r2" }, [
        h(Text, { style: [S.td, { width: 90 }], key: 1 }, "방계"),
        h(Text, { style: [S.td, { width: 130 }], key: 2 }, "형제·조부모 등"),
        h(Text, { style: [S.td, { width: 70 }], key: 3 }, "50%"),
        h(Text, { style: [S.td, { flex: 1 }], key: 4 }, "기준액 × 0.5"),
      ]),
    ]),

    h(Text, { style: S.h2 }, "제5조 (근속 가산)"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "근속가산기준년수"),
      h(Text, { style: S.value, key: "v" }, "5년"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "근속가산율"),
      h(Text, { style: S.value, key: "v" }, "10%"),
    ]),
    h(
      Text,
      { style: S.p },
      "근속 5년 이상의 임직원에 대해서는 지원금에 10%를 가산한다. 다만 가산 후 금액이 최대지원한도(2,000,000원)를 초과하는 경우 한도액으로 보정한다."
    ),

    h(Text, { style: S.h2 }, "제6조 (기준일)"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "기준일"),
      h(Text, { style: S.value, key: "v" }, "2026-06-01"),
    ]),
    h(
      Text,
      { style: S.p },
      "근속년수 산정 기준일은 본 운영기준의 적용 시점인 2026-06-01로 한다."
    ),

    h(
      Text,
      { style: S.note },
      "※ 본 문서는 복리후생(경조사 지원) 자동처리 마이크로 SaaS 데모용 샘플입니다. 실제 인사규정이 아니며 시연 목적으로 작성되었습니다."
    )
  )
);

// ──────────────────────────────────────────────────────────────
// PDF 2) 김인사 경조사 신청서 (사망조위) — 개인정보 파싱용 (2탭)
// 추출 대상 개인 변수:
//   성명, 사번, 부서, 직급, 입사일
//   경조분류 = "사망"   → 경로 1 (사망조위) 발동
//   대상자관계 = "부친" → 직계 → 100% 지급
//   대상자성명, 발생일, 신청일, 신청금액, 증빙첨부수
// ──────────────────────────────────────────────────────────────

const PersonDoc = h(
  Document,
  null,
  h(
    Page,
    { size: "A4", style: S.page },
    h(Text, { style: S.title }, "경조사 지원금 신청서"),
    h(
      Text,
      { style: S.sub },
      "접수일 2026-05-20 · 인사팀 접수 · 복리후생 경조사 지원 대상 검토용"
    ),

    h(Text, { style: S.h2 }, "1. 신청인 정보"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "성명"),
      h(Text, { style: S.value, key: "v" }, "김인사"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "사번"),
      h(Text, { style: S.value, key: "v" }, "20180123"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "부서"),
      h(Text, { style: S.value, key: "v" }, "경영지원본부"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "직급"),
      h(Text, { style: S.value, key: "v" }, "과장"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "입사일"),
      h(Text, { style: S.value, key: "v" }, "2018-03-02"),
    ]),

    h(Text, { style: S.h2 }, "2. 경조사 정보 (사망조위)"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "경조분류"),
      h(Text, { style: S.value, key: "v" }, "사망"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "대상자관계"),
      h(Text, { style: S.value, key: "v" }, "부친 (직계)"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "대상자성명"),
      h(Text, { style: S.value, key: "v" }, "김OO (1948-08-15)"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "발생일"),
      h(Text, { style: S.value, key: "v" }, "2026-05-12"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "신청일"),
      h(Text, { style: S.value, key: "v" }, "2026-05-20"),
    ]),

    h(Text, { style: S.h2 }, "3. 지원 신청 내역"),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "신청금액"),
      h(Text, { style: S.value, key: "v" }, "1,000,000원 (희망 지원금)"),
    ]),
    h(View, { style: S.row }, [
      h(Text, { style: S.label, key: "l" }, "증빙첨부수"),
      h(
        Text,
        { style: S.value, key: "v" },
        "3건 (사망진단서·가족관계증명서·장례비 영수증)"
      ),
    ]),

    h(Text, { style: S.h2 }, "4. 참고사항"),
    h(
      Text,
      { style: S.p },
      "발생일(2026-05-12)로부터 8일 경과 시점에 신청하여 신청가능기한 60일 이내에 해당합니다."
    ),
    h(
      Text,
      { style: S.p },
      "근속년수는 입사일(2018-03-02) 기준 약 8년으로, 근속가산 기준(5년) 이상에 해당하여 근속가산율 10% 적용 대상입니다."
    ),
    h(
      Text,
      { style: S.p },
      "대상자 관계가 부친(직계)이므로 사망조위금기준액 1,000,000원의 100%가 적용됩니다."
    ),

    h(
      Text,
      { style: S.note },
      "※ 본 문서는 복리후생 경조사 지원 자동처리 마이크로 SaaS 데모용 샘플입니다. 실재 인물의 정보가 아닌 가공 데이터입니다."
    )
  )
);

await fs.mkdir(outDir, { recursive: true });
await renderToFile(RegDoc, path.join(outDir, "경조사지원_운영기준_샘플.pdf"));
await renderToFile(PersonDoc, path.join(outDir, "김인사_경조사신청서_샘플.pdf"));

console.log("✓ 복리후생 샘플 PDF 2종 생성 완료:");
console.log("  -", path.join(outDir, "경조사지원_운영기준_샘플.pdf"));
console.log("  -", path.join(outDir, "김인사_경조사신청서_샘플.pdf"));
