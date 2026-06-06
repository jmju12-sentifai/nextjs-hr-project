// 복리후생(경조사 지원) 자동처리 마이크로 SaaS 앱 기획서
// public/samples/spec-welfare-sample.pdf 로 출력
// 빌더 "📄 기획서 업로드 (AI 자동 채움)" 시 사용 가능
//
// 임금피크제와 다른 도메인 — 경조 분류·대상자 관계 기반 다중 경로 시연
//
// 실행: node scripts/make-spec-welfare.mjs

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

const COL = {
  ink: "#0f172a",
  sub: "#475569",
  line: "#cbd5e1",
  blue: "#2563eb",
  blueBg: "#dbeafe",
  blueLight: "#eff6fe",
  blueHead: "#1d4ed8",
  rose: "#dc2626",
  amber: "#b45309",
  violet: "#7c3aed",
};

const S = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 36,
    fontFamily: "NotoKR",
    fontSize: 9,
    lineHeight: 1.4,
    color: COL.ink,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: COL.blue,
    textAlign: "center",
    marginBottom: 2,
  },
  topSub: {
    fontSize: 9,
    color: COL.sub,
    textAlign: "center",
    marginBottom: 6,
    paddingBottom: 8,
    borderBottom: `2px solid ${COL.blue}`,
  },
  secBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COL.blueBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 6,
  },
  secLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  secMeta: { fontSize: 8, color: COL.sub },
  table: { marginBottom: 4 },
  trH: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tr: {
    flexDirection: "row",
    borderTop: `0.5px solid ${COL.line}`,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: { fontSize: 8.5, fontWeight: 700, color: COL.sub },
  td: { fontSize: 8.5, color: COL.ink },
  rowKv: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderTop: `0.5px solid ${COL.line}`,
  },
  rowKvLabel: { width: 90, color: COL.sub, fontSize: 8.5 },
  rowKvValue: { flex: 1, fontSize: 8.5 },
  miniBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: COL.blueLight,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 3,
  },
  miniLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: COL.blue,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  miniLabelFb: {
    fontSize: 8,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: COL.rose,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  miniTitle: { fontSize: 9.5, fontWeight: 700, marginLeft: 6 },
  miniCond: { fontSize: 8, color: COL.sub },
  reportBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
    marginBottom: 4,
  },
  reportChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f8fafc",
    border: `0.5px solid ${COL.line}`,
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    borderRadius: 2,
    fontSize: 7.8,
  },
  chipDot: {
    width: 6,
    height: 6,
    backgroundColor: COL.blue,
    borderRadius: 1,
  },
  noteBox: {
    backgroundColor: "#fef3c7",
    borderLeft: `2px solid ${COL.amber}`,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 8,
    color: COL.amber,
    borderRadius: 2,
    marginTop: 2,
  },
});

const h = React.createElement;

const SectionBar = (num, title, meta) =>
  h(View, { style: S.secBar }, [
    h(View, { style: S.secLeft, key: "l" }, [
      h(Text, { style: S.secNum, key: "n" }, num),
      h(Text, { style: S.secTitle, key: "t" }, " " + title),
    ]),
    meta ? h(Text, { style: S.secMeta, key: "m" }, meta) : null,
  ]);

const MiniBar = (label, title, cond, kind = "blue") => {
  const labelStyle = kind === "fb" ? S.miniLabelFb : S.miniLabel;
  return h(View, { style: S.miniBar }, [
    h(View, { style: { flexDirection: "row", alignItems: "center" }, key: "l" }, [
      h(Text, { style: labelStyle, key: "lab" }, label),
      h(Text, { style: S.miniTitle, key: "t" }, title),
    ]),
    cond ? h(Text, { style: S.miniCond, key: "c" }, cond) : null,
  ]);
};

const Table = (cols, rows) => {
  const widths = cols.map((c) => c.w || 1);
  const total = widths.reduce((a, b) => a + b, 0);
  const head = h(View, { style: S.trH, key: "h" },
    cols.map((c, i) =>
      h(Text, { key: i, style: [S.th, { flex: widths[i] / total }] }, c.label)
    )
  );
  const body = rows.map((r, ri) =>
    h(View, { style: S.tr, key: ri },
      r.map((cell, ci) =>
        h(Text, { key: ci, style: [S.td, { flex: widths[ci] / total }] },
          String(cell ?? "")
        )
      )
    )
  );
  return h(View, { style: S.table }, [head, ...body]);
};

const Kv = (rows) =>
  h(View, { style: { borderTop: `0.5px solid ${COL.line}`, marginBottom: 4 } },
    rows.map(([k, v], i) =>
      h(View, { style: S.rowKv, key: i }, [
        h(Text, { style: S.rowKvLabel, key: "k" }, k),
        h(Text, { style: S.rowKvValue, key: "v" }, v),
      ])
    )
  );

const Chip = (text) =>
  h(View, { style: S.reportChip }, [
    h(View, { style: S.chipDot, key: "d" }),
    h(Text, { key: "t" }, text),
  ]);

// ───────────── 문서 ─────────────

const Doc = h(
  Document,
  null,

  // ─── PAGE 1 — 앱 개요 + 변수 ───
  h(
    Page,
    { size: "A4", style: S.page },

    h(Text, { style: S.topTitle }, "복리후생(경조사 지원) 자동처리 마이크로 SaaS 앱 기획서"),
    h(Text, { style: S.topSub }, "경조 분류·대상자 관계 기반 다중 경로 (first-match) + LLM 요약 모델"),

    // 1탭 앱 개요
    SectionBar("1탭", "앱 개요", "MSaaS 설명 / 리포트 머리글"),
    Kv([
      ["앱 명", "복리후생(경조사 지원) 자동처리 마이크로 SaaS 앱"],
      [
        "한 줄 설명",
        "임직원의 경조 신청서를 파싱하여 사내 복리후생 규정에 따라 지원 자격과 지급 금액을 자동 산정합니다.",
      ],
      [
        "구축 목적",
        "경조사 신청 처리 업무에서 신청-검토-안내 전 과정을 자동화하여 인사팀 수작업 부담을 줄이고, 직원에게 동일한 기준의 적시 지원을 제공합니다.",
      ],
      [
        "해결하려는 문제",
        "관계·경조 종류·근속년수에 따라 지원 기준이 복잡하게 갈리며, 수작업 검토 시 누락·일관성 결여 문제가 빈번합니다.",
      ],
      ["대상 사용자", "HR 운영팀 · 복리후생 담당자"],
      ["보안/클라우드", "개인정보 보호 · 보안 암호화 · 분석 후 원본 즉시 폐기 · 클라우드 기반"],
      [
        "기대 효과",
        "신청 처리 시간 80% 절감 · 관계·금액 산정 오류 최소화 · 안내문 자동 생성으로 직원 커뮤니케이션 표준화",
      ],
      [
        "핵심 특징",
        "모듈형 마이크로 SaaS — 단계 선택 사용 · 닫힌 문법 결정론 계산 · 경조 종류별 경로 분기로 그룹별 산출·안내",
      ],
      [
        "처리 흐름 4단계",
        "1) 경조 지원 기준파일(취업규칙 부속) 지식화 → 2) 신청서·증빙자료 파싱 → 3) 지원 자격·관계·금액 적정성 판단 → 4) 지원금액 산출 및 개인별 안내자료 생성",
      ],
    ]),

    // 2탭 규정 변수
    SectionBar("2탭", "규정 변수", "취업규칙·복리후생 규정에서 파싱"),
    Table(
      [
        { label: "변수명", w: 2 },
        { label: "타입", w: 1 },
        { label: "단위", w: 0.8 },
        { label: "예시값", w: 2.5 },
      ],
      [
        ["사망조위금기준액", "number", "원", "1,000,000"],
        ["결혼축의금기준액", "number", "원", "500,000"],
        ["출산축하금기준액", "number", "원", "300,000"],
        ["입학지원금기준액", "number", "원", "200,000"],
        ["최대지원한도", "number", "원", "2,000,000"],
        ["신청가능기한", "number", "일", "60"],
        ["근속가산기준년수", "number", "년", "5"],
        ["근속가산율", "number", "%", "10"],
        ["기준일", "date", "—", "2026-06-01"],
      ]
    ),

    // 3탭 개인 변수
    SectionBar("3탭", "개인 변수", "신청서·증빙자료에서 파싱"),
    Table(
      [
        { label: "변수명", w: 2 },
        { label: "타입", w: 1.2 },
        { label: "단위", w: 0.8 },
        { label: "필수", w: 0.6 },
        { label: "예시값", w: 2 },
      ],
      [
        ["성명", "text", "—", "필수", "김인사"],
        ["사번", "text", "—", "필수", "20180123"],
        ["부서", "text", "—", "선택", "경영지원본부"],
        ["직급", "text", "—", "선택", "과장"],
        ["입사일", "date", "—", "필수", "2018-03-02"],
        ["경조분류", "text", "—", "필수", "결혼"],
        ["대상자관계", "text", "—", "필수", "본인"],
        ["대상자성명", "text", "—", "선택", "김인사"],
        ["발생일", "date", "—", "필수", "2026-05-10"],
        ["신청일", "date", "—", "필수", "2026-05-25"],
        ["신청금액", "number", "원", "선택", "500,000"],
        ["증빙첨부수", "number", "건", "선택", "2"],
      ]
    )
  ),

  // ─── PAGE 2 — 분석 로직 ───
  h(
    Page,
    { size: "A4", style: S.page },

    SectionBar(
      "4탭",
      "분석 로직 — 공통 사전 계산 + 다중 경로 (first-match) + LLM 요약"
    ),

    MiniBar("공통", "▤ 공통 사전 계산 (모든 경로 진입 전 실행)"),
    Table(
      [
        { label: "#", w: 0.3 },
        { label: "타입", w: 1.1 },
        { label: "결과변수", w: 1.5 },
        { label: "단위", w: 0.6 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "날짜(diff)", "근속년수", "년", "입사일 → 기준일 차이 (년 단위)"],
        ["2", "날짜(diff)", "경과일수", "일", "발생일 → 신청일 차이 (신청 기한 검증용)"],
        ["3", "구간 보정(clamp)", "근속가산율정규", "%", "근속년수 ≥ 근속가산기준년수 일 때만 가산율 적용, 아니면 0"],
      ]
    ),

    MiniBar("경로 1", "사망조위 지원", "조건: 경조분류 = '사망' AND 경과일수 ≤ 신청가능기한"),
    Table(
      [
        { label: "#", w: 0.3 },
        { label: "타입", w: 1.1 },
        { label: "결과변수", w: 1.5 },
        { label: "단위", w: 0.6 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "분기(branch)", "직계여부", "—", "대상자관계 ∈ '배우자·부모·자녀' → '직계' / 아니면 '방계'"],
        ["2", "구간표(table)", "관계가산율", "%", "직계=100% · 방계=50% (대상자관계 기반)"],
        ["3", "계산식(formula)", "관계반영지원금", "원", "사망조위금기준액 × 관계가산율"],
        ["4", "계산식(formula)", "근속가산금", "원", "관계반영지원금 × (1 + 근속가산율정규)"],
        ["5", "구간 보정(clamp)", "최종지원금", "원", "근속가산금을 최대지원한도 이하로 보정"],
        ["6", "LLM 요약(llm)", "LLM분석", "—", "관계·근속·최종금액을 종합한 안내 메시지 자동 생성"],
      ]
    ),

    MiniBar("경로 2", "결혼·출산 축하", "조건: 경조분류 ∈ '결혼·출산' AND 경과일수 ≤ 신청가능기한"),
    Table(
      [
        { label: "#", w: 0.3 },
        { label: "타입", w: 1.1 },
        { label: "결과변수", w: 1.5 },
        { label: "단위", w: 0.6 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "분기(branch)", "분류별기준액", "원", "경조분류 = '결혼' → 결혼축의금기준액 / 아니면 출산축하금기준액"],
        ["2", "계산식(formula)", "관계반영지원금", "원", "분류별기준액 (관계 가산 없음)"],
        ["3", "계산식(formula)", "근속가산금", "원", "관계반영지원금 × (1 + 근속가산율정규)"],
        ["4", "구간 보정(clamp)", "최종지원금", "원", "근속가산금을 최대지원한도 이하로 보정"],
        ["5", "LLM 요약(llm)", "LLM분석", "—", "축하 메시지와 함께 지급액·신청 절차 안내 생성"],
      ]
    ),

    MiniBar("경로 3", "입학지원", "조건: 경조분류 = '입학' AND 대상자관계 ∈ '자녀'"),
    Table(
      [
        { label: "#", w: 0.3 },
        { label: "타입", w: 1.1 },
        { label: "결과변수", w: 1.5 },
        { label: "단위", w: 0.6 },
        { label: "내용", w: 4 },
      ],
      [
        ["1", "계산식(formula)", "관계반영지원금", "원", "입학지원금기준액"],
        ["2", "계산식(formula)", "근속가산금", "원", "관계반영지원금 × (1 + 근속가산율정규)"],
        ["3", "구간 보정(clamp)", "최종지원금", "원", "근속가산금을 최대지원한도 이하로 보정"],
        ["4", "LLM 요약(llm)", "LLM분석", "—", "자녀 입학 축하·지원 안내 메시지 생성"],
      ]
    ),

    MiniBar(
      "Fallback",
      "▣ 지원 대상 미해당",
      "조건 없음 — 경과일수 초과·해당 분류 없음·관계 미해당 등",
      "fb"
    ),
    h(Text, { style: { fontSize: 8.5, color: COL.sub, marginLeft: 2 } },
      "산출 블록 없음 — 미해당 사유 안내문만 표시 (LLM 요약 1단계로 사유 자동 작성)")
  ),

  // ─── PAGE 3 — 5탭 경로별 리포트 구성 ───
  h(
    Page,
    { size: "A4", style: S.page },

    SectionBar("5탭", "경로별 리포트 구성", "사용자에게 보여줄 안내서 카드 배치"),

    MiniBar("경로 1", "사망조위 지원 — 리포트 카드"),
    h(View, { style: S.reportBox }, [
      Chip("기본정보 묶음 (성명/사번/부서/직급), 6x2"),
      Chip("카드 — 근속년수, 2x2"),
      Chip("카드 — 대상자관계, 2x2"),
      Chip("카드 — 직계여부, 2x2"),
      Chip("카드 — 최종지원금, 2x2"),
      Chip("게이지 — 신청 적기성 (경과/한도), 3x2"),
      Chip("불릿 — 지원금 vs 한도, 3x2"),
      Chip("델타 — 근속 가산 효과 (관계반영 vs 최종), 3x2"),
      Chip("판단 근거 비교표, 6x2"),
      Chip("안내문 카드(note) — {LLM분석}, 6x2"),
    ]),

    MiniBar("경로 2", "결혼·출산 축하 — 리포트 카드"),
    h(View, { style: S.reportBox }, [
      Chip("기본정보 묶음, 6x2"),
      Chip("카드 — 경조분류, 2x2"),
      Chip("카드 — 대상자관계, 2x2"),
      Chip("카드 — 근속년수, 2x2"),
      Chip("카드 — 최종지원금, 2x2"),
      Chip("불릿 — 지원금 vs 한도, 3x2"),
      Chip("델타 — 기준액 → 최종 (근속 가산), 3x2"),
      Chip("판단 근거 비교표, 6x2"),
      Chip("안내문 카드(note) — {LLM분석}, 6x2"),
    ]),

    MiniBar("경로 3", "입학지원 — 리포트 카드"),
    h(View, { style: S.reportBox }, [
      Chip("기본정보 묶음, 6x2"),
      Chip("카드 — 대상자성명, 2x2"),
      Chip("카드 — 근속년수, 2x2"),
      Chip("카드 — 최종지원금, 2x2"),
      Chip("불릿 — 지원금 vs 한도, 3x2"),
      Chip("판단 근거 비교표, 6x2"),
      Chip("안내문 카드(note) — {LLM분석}, 6x2"),
    ]),

    MiniBar("Fallback", "지원 대상 미해당 — 리포트 카드", "", "fb"),
    h(View, { style: S.reportBox }, [
      Chip("기본정보 묶음, 6x2"),
      Chip("카드 — 경조분류, 2x2"),
      Chip("카드 — 대상자관계, 2x2"),
      Chip("카드 — 경과일수, 2x2"),
      Chip("게이지 — 신청 적기성, 3x2"),
      Chip("안내문 카드(note) — 미해당 사유 안내, 6x2"),
    ]),

    h(View, { style: S.noteBox },
      h(Text, null,
        "경로별 안내문 템플릿:\n"
        + "• 사망조위: \"{대상자관계} ({직계여부}) 사망 조위금 {최종지원금} 지원 결정. 근속 {근속년수}년 가산 {근속가산율정규} 반영.\"\n"
        + "• 결혼·출산: \"{경조분류} 축하금 {최종지원금} 지원 결정. {대상자관계} 대상.\"\n"
        + "• 입학지원: \"{대상자성명} 입학 지원금 {최종지원금} 결정.\"\n"
        + "• 미해당: \"경조분류 {경조분류}, 관계 {대상자관계}, 경과일수 {경과일수}일 — 지원 기준 미충족.\"\n"
        + "→ 모든 안내문은 LLM이 산출 결과를 종합해 자연어 2~3문장으로 자동 생성합니다."
      )
    )
  )
);

await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, "spec-welfare-sample.pdf");
await renderToFile(Doc, out);
console.log("✓", path.relative(process.cwd(), out));
