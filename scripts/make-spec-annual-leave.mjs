// 연차 미사용 보상금 산정 규정 — 참고 문서(PDF) 샘플
// public/samples/spec-annual-leave-sample.pdf 로 출력
// 빌더 "참고 문서 분석 (AI 자동 채움)" 업로드용.
//
// 목적: 이번에 추가한 수식 기능과 미지원 수식 차단을 둘 다 검증할 수 있는 문서.
//   ✅ 지원(계산돼야 함): 내림 floor / 나머지 % / 몫 //  + 사칙·날짜차이
//   🚫 미지원(차단돼야 함): IF(...) / MIN(...) / VLOOKUP(...) 등 함수식
//
// 실행: node scripts/make-spec-annual-leave.mjs

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
const h = React.createElement;

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

const COL = {
  ink: "#0f172a",
  sub: "#475569",
  mute: "#94a3b8",
  line: "#cbd5e1",
  blue: "#2563eb",
  blueBg: "#dbeafe",
  blueLight: "#eff6fe",
  blueHead: "#1d4ed8",
  rose: "#dc2626",
  roseBg: "#fee2e2",
  emerald: "#059669",
  emeraldBg: "#d1fae5",
  amber: "#b45309",
};

const S = StyleSheet.create({
  page: {
    padding: 30,
    paddingBottom: 40,
    fontFamily: "NotoKR",
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COL.ink,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: COL.blue,
    textAlign: "center",
    marginBottom: 2,
  },
  topSub: {
    fontSize: 9,
    color: COL.sub,
    textAlign: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: `2px solid ${COL.blue}`,
  },
  secBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COL.blueBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  secNum: {
    backgroundColor: COL.blue,
    color: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8.5,
    fontWeight: 700,
    borderRadius: 2,
  },
  secTitle: { fontSize: 11, fontWeight: 700, color: COL.blueHead },
  p: { marginBottom: 3 },
  li: { marginBottom: 2, paddingLeft: 8 },
  // 표
  trH: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottom: `0.5px solid ${COL.line}`,
  },
  tr: {
    flexDirection: "row",
    borderBottom: `0.5px solid ${COL.line}`,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  th: { fontSize: 8.5, fontWeight: 700, color: COL.sub },
  td: { fontSize: 8.5, color: COL.ink },
  mono: { fontFamily: "Courier", fontSize: 8.5, color: COL.ink },
  // 박스
  okBox: {
    backgroundColor: COL.emeraldBg,
    borderLeft: `3px solid ${COL.emerald}`,
    borderRadius: 3,
    padding: 8,
    marginTop: 6,
  },
  badBox: {
    backgroundColor: COL.roseBg,
    borderLeft: `3px solid ${COL.rose}`,
    borderRadius: 3,
    padding: 8,
    marginTop: 6,
  },
  boxTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 3 },
});

// 표 행 헬퍼 — cols: [{w, text, head?}]
const Row = (cells, head = false) =>
  h(
    View,
    { style: head ? S.trH : S.tr },
    cells.map((c, i) =>
      h(
        Text,
        { key: i, style: [{ width: c.w }, head ? S.th : c.mono ? S.mono : S.td] },
        c.text
      )
    )
  );

const Sec = (num, title) =>
  h(View, { style: S.secBar }, [
    h(Text, { key: "n", style: S.secNum }, num),
    h(Text, { key: "t", style: S.secTitle }, title),
  ]);

const Doc = h(
  Document,
  null,
  h(Page, { size: "A4", style: S.page }, [
    h(Text, { key: "t", style: S.topTitle }, "연차 미사용 보상금 산정 규정"),
    h(
      Text,
      { key: "s", style: S.topSub },
      "2026 개정 · 인사총무팀 · 미사용 연차에 대한 금전 보상 기준"
    ),

    // 1. 적용 대상 및 입력 정보
    Sec("1", "적용 대상 및 입력 항목"),
    h(Text, { key: "p1", style: S.p }, "재직 중 발생한 미사용 연차에 대해 아래 기준으로 보상금을 산정한다. 산정에 필요한 입력 항목은 다음과 같다."),
    h(View, { key: "tbl1" }, [
      Row([{ w: 110, text: "구분" }, { w: 150, text: "항목" }, { w: 0, text: "비고" }], true),
      Row([{ w: 110, text: "개인" }, { w: 150, text: "성명, 사번" }, { w: 0, text: "기본 식별 정보" }]),
      Row([{ w: 110, text: "개인" }, { w: 150, text: "입사일" }, { w: 0, text: "근속연수 산정 기준일" }]),
      Row([{ w: 110, text: "개인" }, { w: 150, text: "월 통상임금 (원)" }, { w: 0, text: "1일 단가 산정 기준" }]),
      Row([{ w: 110, text: "개인" }, { w: 150, text: "미사용 연차일수 (일)" }, { w: 0, text: "보상 대상 일수" }]),
      Row([{ w: 110, text: "개인" }, { w: 150, text: "미사용 연차시간 (시간)" }, { w: 0, text: "반차·시간차 잔여 산정" }]),
      Row([{ w: 110, text: "개인" }, { w: 150, text: "재직일수 (일)" }, { w: 0, text: "중도퇴사 일할 보상용" }]),
      Row([{ w: 110, text: "규정" }, { w: 150, text: "월 소정근로일수 = 21" }, { w: 0, text: "1일 통상임금 환산" }]),
      Row([{ w: 110, text: "규정" }, { w: 150, text: "1일 소정근로시간 = 8" }, { w: 0, text: "시간→일 환산" }]),
      Row([{ w: 110, text: "규정" }, { w: 150, text: "절사단위 = 10" }, { w: 0, text: "원단위 절사 기준" }]),
      Row([{ w: 110, text: "규정" }, { w: 150, text: "근속가산주기 = 2" }, { w: 0, text: "근속 2년마다 1일 가산" }]),
    ]),

    // 2. 산정 방식 (지원 수식)
    Sec("2", "보상금 산정 산식"),
    h(Text, { key: "p2", style: S.p }, "아래 순서대로 계산한다. 금액·일수는 모두 정수 처리(내림)하며, 단위 절사·나머지·몫 연산을 사용한다."),
    h(View, { key: "tbl2" }, [
      Row([{ w: 24, text: "①" }, { w: 140, text: "산출 항목" }, { w: 0, text: "산식" }], true),
      Row([{ w: 24, text: "①" }, { w: 140, text: "근속연수 (년)" }, { w: 0, text: "오늘 − 입사일 (만 연수)" }]),
      Row([{ w: 24, text: "②" }, { w: 140, text: "1일 통상임금" }, { w: 0, mono: true, text: "floor(월통상임금 / 월소정근로일수)" }]),
      Row([{ w: 24, text: "③" }, { w: 140, text: "가산 연차일수" }, { w: 0, mono: true, text: "floor((근속연수 - 1) / 근속가산주기)" }]),
      Row([{ w: 24, text: "④" }, { w: 140, text: "총 보상 연차일수" }, { w: 0, mono: true, text: "미사용연차일수 + 가산연차일수" }]),
      Row([{ w: 24, text: "⑤" }, { w: 140, text: "보상금(세전)" }, { w: 0, mono: true, text: "1일통상임금 * 총보상연차일수" }]),
      Row([{ w: 24, text: "⑥" }, { w: 140, text: "최종 보상금(절사)" }, { w: 0, mono: true, text: "floor(보상금세전 / 절사단위) * 절사단위" }]),
      Row([{ w: 24, text: "⑦" }, { w: 140, text: "반차 잔여시간" }, { w: 0, mono: true, text: "미사용연차시간 % 1일소정근로시간" }]),
      Row([{ w: 24, text: "⑧" }, { w: 140, text: "중도퇴사 일할 보상금" }, { w: 0, mono: true, text: "최종보상금 * 재직일수 // 365" }]),
    ]),
    h(View, { key: "ok", style: S.okBox }, [
      h(Text, { key: "ot", style: [S.boxTitle, { color: COL.emerald }] }, "✅ 위 산식은 모두 엔진 지원 연산"),
      h(Text, { key: "ob", style: { fontSize: 8.5 } },
        "내림 floor( ), 나머지 %, 몫 // 와 사칙연산·괄호·날짜차이로 구성. 분석 시 formula/date 단계로 만들어져 실제 값이 계산되어야 한다."),
    ]),

    // 3. 미지원 수식 (차단 대상)
    Sec("3", "참고: 기존 스프레드시트 수식 (엔진 미지원)"),
    h(Text, { key: "p3", style: S.p }, "원천징수·지급 상한·직급별 가산은 과거 엑셀에서 아래 함수식으로 관리했다. 본 앱 계산 엔진은 이런 함수를 지원하지 않으므로, 분석 시 산식으로 만들지 말 것(차단). 필요하면 상한은 한도 보정(clamp), 직급별은 분기(switch/table), 조건은 분기(branch)로 표현한다."),
    h(View, { key: "tbl3" }, [
      Row([{ w: 130, text: "항목" }, { w: 0, text: "기존 엑셀 수식" }], true),
      Row([{ w: 130, text: "원천세액" }, { w: 0, mono: true, text: "IF(보상금 >= 1000000, 보상금 * 0.22, 보상금 * 0.066)" }]),
      Row([{ w: 130, text: "지급 상한" }, { w: 0, mono: true, text: "MIN(보상금, 연간지급상한)" }]),
      Row([{ w: 130, text: "직급별 가산율" }, { w: 0, mono: true, text: "VLOOKUP(직급, 가산율표, 2)" }]),
      Row([{ w: 130, text: "지급일 표기" }, { w: 0, mono: true, text: "FORMAT_DATE(TODAY(), 'YYYY-MM-DD')" }]),
    ]),
    h(View, { key: "bad", style: S.badBox }, [
      h(Text, { key: "bt", style: [S.boxTitle, { color: COL.rose }] }, "🚫 위 함수식은 차단되어야 함"),
      h(Text, { key: "bb", style: { fontSize: 8.5 } },
        "IF / MIN / VLOOKUP / FORMAT_DATE 등은 엔진에 없는 함수. 분석이 이를 formula 로 만들면 안 되고, 만들어지더라도 빌더에서 제거되어야 한다. (상한 → clamp(max=연간지급상한), 직급별 → switch, 원천세 조건 → branch 권장)"),
    ]),

    // 4. 결과 화면
    Sec("4", "결과 화면(리포트) 구성"),
    h(Text, { key: "p4", style: S.p }, "직원이 보는 결과 화면에는 다음을 표시한다:"),
    h(Text, { key: "l1", style: S.li }, "• 기본정보 묶음 (성명/사번/입사일)"),
    h(Text, { key: "l2", style: S.li }, "• 큰 숫자 카드 — 최종 보상금"),
    h(Text, { key: "l3", style: S.li }, "• 카드 — 1일 통상임금, 총 보상 연차일수"),
    h(Text, { key: "l4", style: S.li }, "• 계산식 카드 — 보상금 산출 과정(②~⑥)"),
    h(Text, { key: "l5", style: S.li }, "• 안내문 — 산출 결과를 한 문단으로 요약 (LLM 분석)"),
  ])
);

await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, "spec-annual-leave-sample.pdf");
await renderToFile(Doc, out);
console.log("✓", path.relative(process.cwd(), out));
