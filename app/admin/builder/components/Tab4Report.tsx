"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  AppSchema,
  ChartType,
  ElementKind,
  Height,
  Path,
  ReportElement,
  Width,
} from "app-renderer";
import { migrateSchema, run } from "app-renderer";
import ElementRenderer from "./ElementRenderer";

const uid = () => Math.random().toString(36).slice(2, 7);

interface Props {
  schema: AppSchema;
  onChange: (s: AppSchema) => void;
}

interface PaletteItem {
  kind: ElementKind;
  ctype?: ChartType;
  t: string;
  s: string;
  use: string;
}

const PAL: PaletteItem[] = [
  { kind: "field", t: "기본정보", s: "텍스트 한 줄", use: "성명·사번 같은 단일 변수를 한 줄로 보여줄 때" },
  { kind: "fields", t: "기본정보 묶음", s: "여러 변수를 가로로 (성명 홍길동 | 사번 …)", use: "헤더에 인적사항 여러 개를 가로로 나열할 때" },
  { kind: "pathlabel", t: "경로 정보", s: "편집 중인 경로 라벨 (고정값)", use: "어느 분기 경로의 리포트인지 명시할 때" },
  { kind: "card", t: "요약 카드", s: "핵심 결과 큰 숫자", use: "최종 금액·점수 등 가장 강조할 결과 1개" },
  { kind: "compare", t: "판단 근거 비교표", s: "판정부 그대로", use: "조건 ↔ 입력값을 표로 보여주며 근거를 설명할 때" },
  { kind: "calc", t: "산출 근거", s: "계산식 + 결과값", use: "어떤 식으로 결과가 나왔는지 수식으로 보여줄 때" },
  { kind: "incexc", t: "포함/제외 태그", s: "분류 단계 항목", use: "분류 단계별 포함/제외 항목을 칩으로 나열할 때" },
  { kind: "list", t: "목록 카드", s: "여러 건 텍스트 → 줄 단위", use: "경력내역·보유자격처럼 여러 건이 담긴 텍스트를 항목별로 정리해 보여줄 때" },
  { kind: "chart", ctype: "bar", t: "구간 막대 차트", s: "구간표 → 막대", use: "구간별 값/비율을 직관적으로 비교할 때" },
  { kind: "chart", ctype: "step", t: "구간 계단선", s: "연령별 감액률 등", use: "연령·기간별 비율이 계단식으로 바뀌는 표현" },
  { kind: "chart", ctype: "donut", t: "포함/제외 도넛", s: "분류 비율", use: "전체 대비 포함/제외 비율을 한눈에 볼 때" },
  { kind: "chart", ctype: "gauge", t: "게이지", s: "점수·등급의 위치", use: "점수가 어느 구간(저/중/고)에 있는지" },
  { kind: "chart", ctype: "bullet", t: "불릿 차트", s: "목표 대비 실적", use: "목표·기준 대비 실적의 달성 정도" },
  { kind: "chart", ctype: "stacked", t: "누적 가로 막대", s: "분류 항목 비율", use: "여러 항목의 비중을 한 막대로 누적 표현" },
  { kind: "chart", ctype: "comparison", t: "이중 막대", s: "두 값 크기 비교", use: "두 값(이전/이후, A/B)의 크기를 나란히" },
  { kind: "chart", ctype: "delta", t: "Δ 변화량", s: "전→후 증감 표시", use: "기준 대비 증감(+/-)을 강조" },
  { kind: "chart", ctype: "ratio", t: "비율 게이지", s: "A / B 달성률", use: "두 수 사이 달성률을 게이지로" },
  { kind: "note", t: "안내문", s: "{변수}로 문장", use: "안내 문구·면책 문장 등 자유 텍스트" },
];

function PalettePreview({ item }: { item: PaletteItem }) {
  const k = item.kind + (item.ctype ? "|" + item.ctype : "");
  const wrap = (children: React.ReactNode) => (
    <svg viewBox="0 0 220 110" className="w-full h-[110px]">
      {children}
    </svg>
  );
  switch (k) {
    case "field":
      return wrap(
        <>
          <text x="12" y="58" fontSize="11" fill="#64748b">성명</text>
          <text x="50" y="58" fontSize="13" fontWeight="600" fill="#0f172a">홍길동</text>
        </>
      );
    case "fields":
      return wrap(
        <>
          <text x="10" y="40" fontSize="10" fill="#64748b">성명</text>
          <text x="42" y="40" fontSize="11" fontWeight="600" fill="#0f172a">홍길동</text>
          <text x="100" y="40" fontSize="10" fill="#64748b">사번</text>
          <text x="128" y="40" fontSize="11" fontWeight="600" fill="#0f172a">12345</text>
          <text x="10" y="72" fontSize="10" fill="#64748b">부서</text>
          <text x="42" y="72" fontSize="11" fontWeight="600" fill="#0f172a">인사팀</text>
        </>
      );
    case "pathlabel":
      return wrap(
        <>
          <rect x="20" y="40" width="180" height="32" rx="6" fill="#eef2ff" stroke="#c7d2fe" />
          <text x="34" y="60" fontSize="11" fill="#3730a3">경로: 정규직 / 5년 이상 / B형</text>
        </>
      );
    case "card":
      return wrap(
        <>
          <rect x="20" y="20" width="180" height="72" rx="8" fill="#fef3c7" stroke="#fcd34d" />
          <text x="34" y="48" fontSize="10" fill="#92400e">최종 지급액</text>
          <text x="34" y="80" fontSize="22" fontWeight="800" fill="#7c2d12">12,450,000원</text>
        </>
      );
    case "compare":
      return wrap(
        <>
          <rect x="10" y="14" width="200" height="20" fill="#f1f5f9" />
          <text x="20" y="28" fontSize="10" fill="#475569">조건</text>
          <text x="110" y="28" fontSize="10" fill="#475569">입력</text>
          <line x1="10" y1="34" x2="210" y2="34" stroke="#e2e8f0" />
          <text x="20" y="52" fontSize="10" fill="#0f172a">근속 ≥ 5년</text>
          <text x="110" y="52" fontSize="10" fontWeight="600" fill="#16a34a">7년 ✓</text>
          <line x1="10" y1="60" x2="210" y2="60" stroke="#e2e8f0" />
          <text x="20" y="78" fontSize="10" fill="#0f172a">직군 = 정규직</text>
          <text x="110" y="78" fontSize="10" fontWeight="600" fill="#16a34a">정규직 ✓</text>
        </>
      );
    case "calc":
      return wrap(
        <>
          <text x="14" y="42" fontSize="11" fill="#0f172a">기본급 × 근속 × 0.5</text>
          <text x="14" y="62" fontSize="10" fill="#64748b">= 3,000,000 × 7 × 0.5</text>
          <text x="14" y="86" fontSize="14" fontWeight="700" fill="#0369a1">= 10,500,000</text>
        </>
      );
    case "incexc":
      return wrap(
        <>
          <rect x="10" y="20" width="62" height="22" rx="11" fill="#dcfce7" stroke="#86efac" />
          <text x="22" y="35" fontSize="10" fill="#166534">✓ 정규직</text>
          <rect x="78" y="20" width="62" height="22" rx="11" fill="#dcfce7" stroke="#86efac" />
          <text x="90" y="35" fontSize="10" fill="#166534">✓ 5년↑</text>
          <rect x="10" y="52" width="62" height="22" rx="11" fill="#fee2e2" stroke="#fca5a5" />
          <text x="22" y="67" fontSize="10" fill="#991b1b">✕ 휴직</text>
          <rect x="78" y="52" width="62" height="22" rx="11" fill="#fee2e2" stroke="#fca5a5" />
          <text x="90" y="67" fontSize="10" fill="#991b1b">✕ 징계</text>
        </>
      );
    case "list":
      return wrap(
        <>
          <circle cx="18" cy="30" r="7" fill="#eff6ff" stroke="#bfdbfe" />
          <text x="15" y="34" fontSize="9" fill="#2563eb">1</text>
          <text x="32" y="34" fontSize="11" fontWeight="600" fill="#0f172a">A사</text>
          <text x="60" y="34" fontSize="9" fill="#64748b">2020-03 ~ 2023-02 · 인사기획</text>
          <line x1="10" y1="44" x2="210" y2="44" stroke="#e2e8f0" />
          <circle cx="18" cy="60" r="7" fill="#eff6ff" stroke="#bfdbfe" />
          <text x="15" y="64" fontSize="9" fill="#2563eb">2</text>
          <text x="32" y="64" fontSize="11" fontWeight="600" fill="#0f172a">B사</text>
          <text x="60" y="64" fontSize="9" fill="#64748b">2023-03 ~ 2025-02 · 제조업</text>
          <line x1="10" y1="74" x2="210" y2="74" stroke="#e2e8f0" />
          <circle cx="18" cy="90" r="7" fill="#eff6ff" stroke="#bfdbfe" />
          <text x="15" y="94" fontSize="9" fill="#2563eb">3</text>
          <text x="32" y="94" fontSize="11" fontWeight="600" fill="#0f172a">C사</text>
          <text x="60" y="94" fontSize="9" fill="#64748b">2025-03 ~ · 유통</text>
        </>
      );
    case "chart|bar":
      // 점수 구간별 분포 — 강조 바(현재 위치) + 값 라벨
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">점수 구간별 분포</text>
          <rect x="22" y="58" width="26" height="32" fill="#dbeafe" />
          <rect x="54" y="44" width="26" height="46" fill="#bfdbfe" />
          <rect x="86" y="28" width="26" height="62" fill="#3b82f6" />
          <rect x="118" y="40" width="26" height="50" fill="#bfdbfe" />
          <rect x="150" y="62" width="26" height="28" fill="#dbeafe" />
          <text x="90" y="24" fontSize="9" fontWeight="700" fill="#1d4ed8">42명</text>
          <line x1="18" y1="90" x2="182" y2="90" stroke="#94a3b8" />
          <text x="24" y="102" fontSize="8" fill="#94a3b8">~60</text>
          <text x="56" y="102" fontSize="8" fill="#94a3b8">~70</text>
          <text x="88" y="102" fontSize="8" fill="#1d4ed8" fontWeight="700">~80</text>
          <text x="120" y="102" fontSize="8" fill="#94a3b8">~90</text>
          <text x="152" y="102" fontSize="8" fill="#94a3b8">~100</text>
        </>
      );
    case "chart|step":
      // 연령별 감액률 — 계단 + 현재 위치 마커
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">연령별 감액률</text>
          <text x="10" y="30" fontSize="8" fill="#94a3b8">30%</text>
          <text x="10" y="58" fontSize="8" fill="#94a3b8">15%</text>
          <text x="10" y="86" fontSize="8" fill="#94a3b8">0%</text>
          <line x1="30" y1="88" x2="200" y2="88" stroke="#cbd5e1" />
          <polyline points="30,85 70,85 70,62 110,62 110,40 150,40 150,22 200,22" fill="none" stroke="#6366f1" strokeWidth="2.5" />
          <circle cx="120" cy="40" r="4" fill="#6366f1" />
          <text x="126" y="36" fontSize="8" fontWeight="700" fill="#4338ca">현재 22%</text>
          <text x="56" y="102" fontSize="8" fill="#94a3b8">55세</text>
          <text x="98" y="102" fontSize="8" fill="#94a3b8">58세</text>
          <text x="140" y="102" fontSize="8" fill="#94a3b8">60세</text>
          <text x="180" y="102" fontSize="8" fill="#94a3b8">62세</text>
        </>
      );
    case "chart|donut":
      // 포함/제외 비율 — 중앙에 큰 숫자, 범례
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">포함 / 제외 비율</text>
          <circle cx="62" cy="62" r="32" fill="none" stroke="#e2e8f0" strokeWidth="14" />
          <circle cx="62" cy="62" r="32" fill="none" stroke="#6366f1" strokeWidth="14" strokeDasharray="120.6 201" transform="rotate(-90 62 62)" />
          <text x="50" y="60" fontSize="13" fontWeight="800" fill="#0f172a">60%</text>
          <text x="44" y="74" fontSize="8" fill="#64748b">포함</text>
          <rect x="120" y="34" width="10" height="10" rx="2" fill="#6366f1" />
          <text x="136" y="43" fontSize="10" fill="#0f172a" fontWeight="600">포함</text>
          <text x="180" y="43" fontSize="10" fill="#475569">12건</text>
          <rect x="120" y="54" width="10" height="10" rx="2" fill="#e2e8f0" />
          <text x="136" y="63" fontSize="10" fill="#0f172a" fontWeight="600">제외</text>
          <text x="180" y="63" fontSize="10" fill="#475569">8건</text>
          <text x="120" y="84" fontSize="9" fill="#94a3b8">총 20건</text>
        </>
      );
    case "chart|gauge":
      // 점수 위치 — 구간(저/중/고) + 바늘
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">평가 점수 위치</text>
          <path d="M 30 88 A 80 80 0 0 1 83.7 27.5" fill="none" stroke="#fca5a5" strokeWidth="12" strokeLinecap="round" />
          <path d="M 83.7 27.5 A 80 80 0 0 1 136.3 27.5" fill="none" stroke="#fcd34d" strokeWidth="12" />
          <path d="M 136.3 27.5 A 80 80 0 0 1 190 88" fill="none" stroke="#86efac" strokeWidth="12" strokeLinecap="round" />
          <line x1="110" y1="88" x2="166.57" y2="31.43" stroke="#0f172a" strokeWidth="2.5" />
          <circle cx="110" cy="88" r="5" fill="#0f172a" />
          <text x="34" y="100" fontSize="8" fill="#b91c1c">저</text>
          <text x="106" y="14" fontSize="8" fill="#a16207">중</text>
          <text x="180" y="100" fontSize="8" fill="#166534">고</text>
          <text x="92" y="74" fontSize="13" fontWeight="800" fill="#0f172a">75점</text>
        </>
      );
    case "chart|bullet":
      // 목표 대비 실적
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">목표 대비 실적</text>
          <rect x="20" y="34" width="180" height="24" rx="2" fill="#f1f5f9" />
          <rect x="20" y="34" width="60" height="24" fill="#e2e8f0" />
          <rect x="80" y="34" width="60" height="24" fill="#cbd5e1" />
          <rect x="20" y="42" width="120" height="8" fill="#1e293b" />
          <line x1="150" y1="28" x2="150" y2="64" stroke="#ef4444" strokeWidth="2.5" />
          <text x="142" y="24" fontSize="8" fontWeight="700" fill="#ef4444">목표 150</text>
          <text x="20" y="78" fontSize="9" fill="#475569">실적</text>
          <text x="42" y="78" fontSize="11" fontWeight="700" fill="#0f172a">120</text>
          <text x="72" y="78" fontSize="9" fill="#94a3b8">(80% 달성)</text>
        </>
      );
    case "chart|stacked":
      // 분류 항목 비율
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">분류 항목 비율</text>
          <rect x="20" y="28" width="180" height="26" rx="3" fill="#f1f5f9" />
          <rect x="20" y="28" width="90" height="26" fill="#6366f1" />
          <rect x="110" y="28" width="54" height="26" fill="#a5b4fc" />
          <rect x="164" y="28" width="36" height="26" fill="#e0e7ff" />
          <text x="55" y="45" fontSize="10" fontWeight="700" fill="#fff">50%</text>
          <text x="125" y="45" fontSize="10" fontWeight="700" fill="#312e81">30%</text>
          <text x="170" y="45" fontSize="9" fontWeight="700" fill="#312e81">20%</text>
          <rect x="20" y="76" width="8" height="8" fill="#6366f1" />
          <text x="32" y="83" fontSize="9" fill="#334155">정규</text>
          <rect x="74" y="76" width="8" height="8" fill="#a5b4fc" />
          <text x="86" y="83" fontSize="9" fill="#334155">계약</text>
          <rect x="124" y="76" width="8" height="8" fill="#e0e7ff" />
          <text x="136" y="83" fontSize="9" fill="#334155">파견</text>
        </>
      );
    case "chart|comparison":
      // 이중 막대 — 전/후 두 값
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">변경 전 / 후 비교</text>
          <rect x="46" y="50" width="36" height="44" fill="#94a3b8" />
          <rect x="138" y="28" width="36" height="66" fill="#3b82f6" />
          <text x="50" y="44" fontSize="10" fontWeight="700" fill="#334155">3.0M</text>
          <text x="140" y="22" fontSize="10" fontWeight="700" fill="#1d4ed8">4.5M</text>
          <line x1="20" y1="94" x2="200" y2="94" stroke="#94a3b8" />
          <text x="52" y="106" fontSize="9" fill="#475569">변경 전</text>
          <text x="142" y="106" fontSize="9" fill="#1d4ed8" fontWeight="700">변경 후</text>
        </>
      );
    case "chart|delta":
      // Δ 변화량 — 이전→이후 + 증감 배지
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">전기 대비 변화</text>
          <rect x="16" y="26" width="74" height="58" rx="6" fill="#f8fafc" stroke="#e2e8f0" />
          <text x="24" y="44" fontSize="9" fill="#64748b">이전</text>
          <text x="24" y="68" fontSize="16" fontWeight="800" fill="#0f172a">100</text>
          <text x="62" y="68" fontSize="9" fill="#94a3b8">만원</text>
          <text x="100" y="60" fontSize="22" fill="#16a34a">→</text>
          <rect x="130" y="26" width="74" height="58" rx="6" fill="#f0fdf4" stroke="#86efac" />
          <text x="138" y="44" fontSize="9" fill="#15803d">이후</text>
          <text x="138" y="68" fontSize="16" fontWeight="800" fill="#14532d">125</text>
          <text x="176" y="68" fontSize="9" fill="#86efac">만원</text>
          <rect x="70" y="90" width="80" height="16" rx="8" fill="#dcfce7" />
          <text x="86" y="102" fontSize="10" fontWeight="800" fill="#166534">▲ +25 (25%)</text>
        </>
      );
    case "chart|ratio":
      // 비율 게이지 — A/B 달성률
      return wrap(
        <>
          <text x="10" y="12" fontSize="9" fill="#64748b">납입 / 목표 달성률</text>
          <text x="10" y="36" fontSize="9" fill="#475569">달성</text>
          <text x="158" y="36" fontSize="13" fontWeight="800" fill="#0369a1">70%</text>
          <rect x="20" y="46" width="180" height="16" rx="8" fill="#e2e8f0" />
          <rect x="20" y="46" width="126" height="16" rx="8" fill="#0ea5e9" />
          <line x1="146" y1="42" x2="146" y2="66" stroke="#0c4a6e" strokeWidth="2" strokeDasharray="2 2" />
          <text x="20" y="80" fontSize="9" fill="#475569">7,000만원 / 10,000만원</text>
          <text x="146" y="100" fontSize="8" fill="#0c4a6e" textAnchor="middle">현재</text>
        </>
      );
    case "note":
      return wrap(
        <>
          <text x="14" y="32" fontSize="11" fill="#334155">※ 본 리포트는 {`{기준일}`} 기준입니다.</text>
          <line x1="14" y1="40" x2="206" y2="40" stroke="#e2e8f0" />
          <line x1="14" y1="56" x2="206" y2="56" stroke="#e2e8f0" />
          <line x1="14" y1="72" x2="160" y2="72" stroke="#e2e8f0" />
        </>
      );
    default:
      return wrap(<text x="14" y="60" fontSize="11" fill="#94a3b8">미리보기 없음</text>);
  }
}

const wDef: Record<ElementKind, Width> = {
  card: "third",
  field: "third",
  fields: "full",
  pathlabel: "full",
  compare: "full",
  calc: "half",
  incexc: "half",
  list: "half",
  chart: "half",
  note: "full",
};
const hDef: Partial<Record<ElementKind, Height>> = {
  field: 2,
  fields: 2,
  pathlabel: 2,
  card: 2,
  chart: 2,
  compare: 2,
  note: 2,
  calc: 2,
  incexc: 2,
};

// 차트 서브타입별 권장 기본 크기 (wSpan, hSpan)
const chartDef: Record<string, { w: number; h: number }> = {
  bar: { w: 3, h: 2 },
  step: { w: 3, h: 2 },
  donut: { w: 3, h: 2 },
  gauge: { w: 2, h: 2 },
  ratio: { w: 2, h: 2 },
  bullet: { w: 3, h: 2 },
  stacked: { w: 6, h: 2 },
  comparison: { w: 3, h: 3 },
  delta: { w: 3, h: 2 },
};

const wClass: Record<Width, string> = {
  full: "col-span-6",
  half: "col-span-3",
  third: "col-span-2",
};
const hClass: Record<Height, string> = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
};

export default function Tab4Report({ schema, onChange }: Props) {
  const m = migrateSchema(schema);
  const paths = m.paths || [];
  const fallback = m.fallback || {
    id: "fallback",
    label: "미적용",
    conditions: [],
    steps: [],
    report: [],
  };

  // 편집 중인 경로 slot: path.id 또는 fallback.id
  const slots = [
    ...paths.map((p) => ({ id: p.id, label: p.label, isFallback: false })),
    { id: fallback.id, label: fallback.label, isFallback: true },
  ];
  const slotIdsKey = slots.map((s) => s.id).join("|");
  const [slot, setSlot] = useState<string>(() => slots[0]?.id || fallback.id);

  useEffect(() => {
    if (!slotIdsKey.split("|").includes(slot)) {
      setSlot(slots[0]?.id || fallback.id);
    }
    // 슬롯 키 문자열 비교 → 같은 ids 일 땐 effect 가 다시 안 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIdsKey]);

  const result = run(schema);
  const { sc, disp, jres } = result;

  const isFallbackSlot = slot === fallback.id;

  const currentReport = (): ReportElement[] => {
    if (isFallbackSlot) return fallback.report || [];
    return paths.find((p) => p.id === slot)?.report || [];
  };

  const setCurrentReport = (next: ReportElement[]) => {
    if (isFallbackSlot) {
      onChange({ ...m, fallback: { ...fallback, report: next } });
    } else {
      onChange({
        ...m,
        paths: paths.map((p) => (p.id === slot ? { ...p, report: next } : p)),
      });
    }
  };

  const [dragging, setDragging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // 타겟 카드의 앞(false)/뒤(true) 어디에 삽입할지 — 커서가 카드의 좌/우(전체폭은 상/하) 절반 중 어디인지로 결정
  const [overAfter, setOverAfter] = useState(false);
  const [hoverPal, setHoverPal] = useState<{
    item: PaletteItem;
    accentBar: string;
    x: number;
    y: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const lastOrder = useRef<string>("");
  const dragSnapshot = useRef<Map<string, DOMRect>>(new Map());
  // 재정렬 직후 커서 위치 — 너무 작은 움직임으로 또 재정렬되는 진동 방지
  const lastReorderPos = useRef<{ x: number; y: number } | null>(null);

  const wSpanOf = (e: ReportElement) =>
    Math.max(1, Math.min(6, e.wSpan ?? ({ full: 6, half: 3, third: 2 }[e.w || "full"] || 6)));
  const hSpanOf = (e: ReportElement) =>
    Math.max(1, Math.min(6, e.hSpan ?? (e.h || 1)));
  const widthFromSpan = (n: number): Width =>
    n >= 6 ? "full" : n >= 3 ? "half" : "third";

  const startResize = (id: string) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cs = getComputedStyle(canvas);
    const gap = parseFloat(cs.columnGap || cs.gap || "12") || 12;
    const colWidth = (canvas.clientWidth - gap * 5 - 32) / 6; // 32 = p-4 (16+16)
    const rowHeight = 96 + gap;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const el = currentReport().find((x) => x.id === id);
    if (!el) return;
    const startW = wSpanOf(el);
    const startH = hSpanOf(el);

    const onMove = (m: MouseEvent) => {
      const dx = m.clientX - startX;
      const dy = m.clientY - startY;
      const newW = Math.max(1, Math.min(6, Math.round(startW + dx / colWidth)));
      const newH = Math.max(1, Math.min(6, Math.round(startH + dy / rowHeight)));
      const cur = currentReport().find((x) => x.id === id);
      if (!cur) return;
      if (wSpanOf(cur) === newW && hSpanOf(cur) === newH) return;
      updEl(id, {
        wSpan: newW,
        hSpan: newH,
        w: widthFromSpan(newW),
        h: (Math.min(3, newH) as Height) || 1,
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const allNames = () => {
    const n = schema.vars.map((v) => v.name);
    n.push("적용여부");
    for (const s of m.shared?.steps || []) if (s.name) n.push(s.name);
    // 편집 중인 경로의 step 이름도 보임
    const editing = isFallbackSlot ? fallback : paths.find((p) => p.id === slot);
    for (const s of editing?.steps || []) if (s.name) n.push(s.name);
    return n;
  };
  // 변수 메타 맵 — 이름 → {group, subGroup}. 그루핑된 옵션 렌더링에 사용.
  const varsMeta: Record<string, { group?: string; subGroup?: string }> = {};
  for (const v of schema.vars) varsMeta[v.name] = { group: v.group, subGroup: v.subGroup };

  // fields 종류는 항상 리포트 최상단에 고정
  const pinFieldsTop = (arr: ReportElement[]): ReportElement[] => {
    const top = arr.filter((e) => e.kind === "fields");
    const rest = arr.filter((e) => e.kind !== "fields");
    return [...top, ...rest];
  };

  const addEl = (item: PaletteItem) => {
    const isChart = item.kind === "chart" && item.ctype && chartDef[item.ctype];
    const wSpan = isChart ? chartDef[item.ctype!].w : undefined;
    const hSpan = isChart ? chartDef[item.ctype!].h : undefined;
    const widthFromSpan = (n: number): Width =>
      n >= 6 ? "full" : n >= 3 ? "half" : "third";
    const el: ReportElement = {
      id: uid(),
      kind: item.kind,
      ctype: item.ctype,
      label: item.t,
      bind: "",
      w: wSpan ? widthFromSpan(wSpan) : wDef[item.kind] || "full",
      h: (hSpan ? Math.min(3, hSpan) : hDef[item.kind] || 2) as Height,
      wSpan,
      hSpan,
      tpl: item.kind === "note" ? "{성명} 님은 {적용여부}입니다." : undefined,
    };
    setCurrentReport(pinFieldsTop([...currentReport(), el]));
  };

  const updEl = (id: string, patch: Partial<ReportElement>) =>
    setCurrentReport(currentReport().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const delEl = (id: string) => setCurrentReport(currentReport().filter((e) => e.id !== id));

  const onDropNew = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const key = e.dataTransfer.getData("new");
    if (!key) return;
    const [kind, ctype] = key.split("|");
    const item =
      PAL.find((p) => p.kind === kind && (p.ctype || "") === (ctype || "")) ||
      PAL.find((p) => p.kind === kind);
    if (item) addEl(item);
  };

  const commitReorder = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && overId && draggedId !== overId) {
      setCurrentReport(pinFieldsTop(displayedList));
    }
    setDraggedId(null);
    setOverId(null);
    setOverAfter(false);
  };

  const list = currentReport();

  // 드래그 중 가상 재정렬 — 다른 카드 위로 가면 미리 위치를 보여줌
  const displayedList: ReportElement[] = (() => {
    if (!draggedId || !overId || draggedId === overId) return list;
    const from = list.findIndex((x) => x.id === draggedId);
    let to = list.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0) return list;
    if (overAfter) to += 1; // 타겟 뒤에 삽입
    if (from < to) to -= 1; // 제거로 인한 인덱스 보정
    if (to === from) return list;
    const next = [...list];
    const [mv] = next.splice(from, 1);
    next.splice(to, 0, mv);
    return pinFieldsTop(next);
  })();

  // FLIP — displayedList의 순서가 실제로 바뀐 경우에만 부드럽게 재배치
  useLayoutEffect(() => {
    const orderKey = displayedList.map((x) => x.id).join("|");
    if (orderKey === lastOrder.current) return; // 순서 안 바뀜 → 아무것도 안 함 (다른 효과 보호)

    // 진행 중인 인라인 transform 정리 (정확한 레이아웃 측정 위함)
    cardRefs.current.forEach((el) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = "";
    });

    const newRects = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, id) => {
      if (el) newRects.set(id, el.getBoundingClientRect());
    });

    // 첫 측정은 비교 대상 없으므로 애니메이션 없이 저장만
    if (lastOrder.current !== "") {
      prevRects.current.forEach((prev, id) => {
        if (id === draggedId) return; // 드래그 중인 카드는 브라우저가 직접 그림
        const el = cardRefs.current.get(id);
        const nx = newRects.get(id);
        if (!el || !nx) return;
        const dx = prev.left - nx.left;
        const dy = prev.top - nx.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        void el.offsetWidth;
        el.style.transition = "transform 160ms ease-out";
        el.style.transform = "translate(0,0)";
      });
    }

    prevRects.current = newRects;
    lastOrder.current = orderKey;

    // 드래그 중이면 hit-test 용 스냅샷도 현재 레이아웃으로 갱신
    // (재정렬 후 카드의 시각 위치가 바뀌었으므로, 사용자가 보는 좌표로 다시 hit-test 해야 함)
    if (draggedId) {
      dragSnapshot.current = new Map(newRects);
    }
  }, [displayedList, draggedId]);

  const unitsTotal = list.reduce((a, e) => a + wSpanOf(e) * hSpanOf(e), 0);
  // A4 1페이지 용량: 6열 × 약 8행 = 48 unit
  const pages = Math.max(1, Math.ceil(unitsTotal / 48));
  const isActivePath = result.activePathId === slot;

  return (
    <>
      {/* hoverPal은 space-y-5 밖에 둠 — 첫 자식이 되어 헤더에 margin-top 추가로 페이지 흔드는 문제 방지 */}
      {hoverPal && (
        <div
          className="fixed w-[260px] pointer-events-none"
          style={{
            left: Math.min(hoverPal.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 270),
            top: Math.min(hoverPal.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 220),
            zIndex: 9999,
          }}
        >
          <div className="rounded-lg border bg-white shadow-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`inline-block w-1.5 h-3 ${hoverPal.accentBar} rounded`} />
              <span className="text-xs font-semibold text-gray-800">{hoverPal.item.t}</span>
            </div>
            <div className="text-[10px] text-gray-500 mb-2 leading-snug">
              {hoverPal.item.use}
            </div>
            <div className="rounded border bg-gray-50 p-1">
              <PalettePreview item={hoverPal.item} />
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5 leading-snug">
              형태: {hoverPal.item.s}
            </div>
          </div>
        </div>
      )}
    <div className="space-y-5">
      <div className="pb-5 border-b border-gray-100">
        <div className="text-xs font-mono uppercase tracking-wider text-blue-700 mb-2">
          Layer 4 · WYSIWYG
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">리포트 구성</h2>
        <p className="text-base text-gray-600 whitespace-nowrap overflow-x-auto">
          경로별로 다른 리포트를 구성합니다 — 활성 경로에 따라 사용자에게 다른 리포트가 노출됩니다.
        </p>
      </div>

      {/* 경로 선택 바 — Tab3 톤앤매너와 통일 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">편집 중:</span>
        {slots.map((s, idx) => {
          const matched = result.activePathId === s.id;
          const on = slot === s.id;
          const isFb = s.isFallback;
          return (
            <button
              key={s.id}
              onClick={() => setSlot(s.id)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono transition " +
                (on
                  ? isFb
                    ? "bg-rose-600 text-white"
                    : "bg-blue-600 text-white"
                  : isFb
                  ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200") +
                (matched ? " ring-2 ring-emerald-400 ring-offset-1" : "")
              }
            >
              <span className="opacity-70">{isFb ? "▣" : `${idx + 1}.`}</span>
              <span className="font-medium">{s.label}</span>
              {matched && (
                <span
                  className={
                    "inline-block w-1.5 h-1.5 rounded-full " +
                    (on ? "bg-white/80" : "bg-emerald-500")
                  }
                  title="현재 활성 경로"
                />
              )}
            </button>
          );
        })}
      </div>

      {!isActivePath && (
        <div className="rounded border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2">
          ⓘ 편집 중인 경로(<b>{slots.find((s) => s.id === slot)?.label}</b>)는 현재
          테스트 변수 기준 활성 경로가 아닙니다 — 미리보기의 일부 변수가 비어 보일 수 있어요.
          ② 변수 탭에서 테스트값을 조정해 이 경로가 매칭되도록 바꾸면 정확한 미리보기가 됩니다.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* palette */}
        <div className="rounded border bg-gray-50 p-3 self-start sticky top-2">
          <h3 className="text-xs font-semibold tracking-wide text-gray-700 mb-1">
            요소 팔레트
          </h3>
          <div className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded text-center mb-3">
            ↓ 우측 캔버스로 끌어다 놓으세요
          </div>
          {(() => {
            const groups: {
              label: string;
              sub?: string;
              icon: string;
              accent: string;
              items: PaletteItem[];
            }[] = [
              {
                label: "텍스트 · 정보",
                icon: "📝",
                accent: "slate",
                items: PAL.filter((p) =>
                  ["field", "fields", "pathlabel", "note"].includes(p.kind)
                ),
              },
              {
                label: "카드 · 표",
                icon: "🧮",
                accent: "amber",
                items: PAL.filter((p) =>
                  ["card", "compare", "calc", "incexc", "list"].includes(p.kind)
                ),
              },
              {
                label: "차트 · 단일 값",
                sub: "값 1개를 시각화",
                icon: "📊",
                accent: "indigo",
                items: PAL.filter(
                  (p) =>
                    p.kind === "chart" &&
                    ["bar", "step", "donut", "gauge", "stacked"].includes(
                      p.ctype || ""
                    )
                ),
              },
              {
                label: "차트 · 두 값 비교",
                sub: "값 2개를 나란히 / 비율로",
                icon: "📈",
                accent: "violet",
                items: PAL.filter(
                  (p) =>
                    p.kind === "chart" &&
                    ["bullet", "comparison", "delta", "ratio"].includes(
                      p.ctype || ""
                    )
                ),
              },
            ];
            const accentMap: Record<
              string,
              { head: string; chip: string; hover: string; bar: string }
            > = {
              slate: {
                head: "text-slate-700",
                chip: "bg-slate-100 text-slate-600 border-slate-200",
                hover: "hover:border-slate-500",
                bar: "bg-slate-400",
              },
              amber: {
                head: "text-amber-800",
                chip: "bg-amber-100 text-amber-700 border-amber-200",
                hover: "hover:border-amber-500",
                bar: "bg-amber-400",
              },
              indigo: {
                head: "text-indigo-800",
                chip: "bg-indigo-100 text-indigo-700 border-indigo-200",
                hover: "hover:border-indigo-500",
                bar: "bg-indigo-400",
              },
              violet: {
                head: "text-violet-800",
                chip: "bg-violet-100 text-violet-700 border-violet-200",
                hover: "hover:border-violet-500",
                bar: "bg-violet-400",
              },
            };
            return groups.map((g) => {
              const a = accentMap[g.accent];
              return (
                <div key={g.label} className="mb-3">
                  <div
                    className={`mb-1.5 pb-1 border-b ${a.head}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px]">{g.icon}</span>
                      <span className="text-[11px] font-semibold tracking-wide">
                        {g.label}
                      </span>
                      <span
                        className={`ml-auto text-[9px] px-1.5 py-px rounded-full border ${a.chip}`}
                      >
                        {g.items.length}
                      </span>
                    </div>
                    {g.sub && (
                      <div className="text-[9px] text-gray-500 ml-4 mt-0.5 font-normal">
                        {g.sub}
                      </div>
                    )}
                  </div>
                  {g.items.map((p) => {
                    const key = p.kind + (p.ctype ? "|" + p.ctype : "");
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("new", key);
                          setHoverPal(null);
                        }}
                        onClick={() => addEl(p)}
                        onMouseEnter={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setHoverPal({
                            item: p,
                            accentBar: a.bar,
                            x: r.right + 8,
                            y: r.top,
                          });
                        }}
                        onMouseLeave={() => setHoverPal(null)}
                        className={`relative rounded border bg-white p-2 mb-1.5 pl-3 cursor-grab ${a.hover} hover:shadow-sm transition`}
                        title="클릭 또는 드래그"
                      >
                        <span
                          className={`absolute left-0 top-0 bottom-0 w-1 ${a.bar} rounded-l`}
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 text-[10px]">⋮⋮</span>
                          <span className="text-xs font-semibold">{p.t}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 ml-4 leading-tight">
                          {p.use}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* canvas */}
        <div className="border rounded bg-white overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2.5 text-sm flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold">
              📄 {slots.find((s) => s.id === slot)?.label} — 리포트 미리보기
            </span>
            <span className="hidden sm:flex items-center gap-3 text-[11px] opacity-90">
              <span className="inline-flex items-center gap-1">
                <kbd className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/20 text-[10px] font-bold">⇕</kbd>
                요소 클릭한 채 끌어 위치 이동
              </span>
              <span className="text-white/40">·</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/20 text-[10px] font-bold">⌟</kbd>
                우하단 모서리 끌어 크기 조절
              </span>
              <span className="text-white/40">·</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/20 text-[10px] font-bold">✕</kbd>
                요소 삭제
              </span>
            </span>
          </div>
          <div
            ref={canvasRef}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
              // 카드 재정렬 — 스냅샷 좌표로만 hit-test (FLIP 이동에 영향 안 받음)
              if (draggedId && dragSnapshot.current.size > 0) {
                const x = e.clientX;
                const y = e.clientY;
                // 직전 재정렬 위치에서 거의 안 움직였으면 무시 (진동 방지)
                const lp = lastReorderPos.current;
                if (lp) {
                  const dx = x - lp.x;
                  const dy = y - lp.y;
                  if (dx * dx + dy * dy < 30 * 30) return;
                }
                let hit: string | null = null;
                let after = false;

                // 0) 모든 카드보다 아래의 빈 공간 → 리스트 맨 뒤로
                let maxBottom = -Infinity;
                dragSnapshot.current.forEach((r, id) => {
                  if (id !== draggedId && r.bottom > maxBottom) maxBottom = r.bottom;
                });
                if (y > maxBottom) {
                  const lastEl = [...displayedList].reverse().find((el) => el.id !== draggedId);
                  if (lastEl) {
                    hit = lastEl.id;
                    after = true;
                  }
                }

                // 1) 정확한 사각형 내부 hit 우선
                if (!hit) {
                  dragSnapshot.current.forEach((r, id) => {
                    if (id === draggedId) return;
                    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                      hit = id;
                    }
                  });
                }

                // 2) 빈 공간이면 같은 행에서 가장 가까운 카드,
                //    행 자체에 없으면 y 기준 가장 가까운 카드로 fallback
                if (!hit) {
                  let bestId: string | null = null;
                  let bestDist = Infinity;
                  dragSnapshot.current.forEach((r, id) => {
                    if (id === draggedId) return;
                    const midX = (r.left + r.right) / 2;
                    const midY = (r.top + r.bottom) / 2;
                    const dx = x - midX;
                    const dy = y - midY;
                    // y 거리에 가중치를 둬서 같은 행이면 우선 선택
                    const dist = Math.abs(dy) * 3 + Math.abs(dx);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestId = id;
                    }
                  });
                  hit = bestId;
                }

                // 타겟 카드의 앞/뒤 결정 — 좌/우 절반 기준.
                // 타겟이나 드래그 카드가 전체폭(6칸)이면 가로 비교가 무의미하므로 상/하 절반 기준.
                if (hit && !after) {
                  const hitRect = dragSnapshot.current.get(hit);
                  const hitEl = currentReport().find((el) => el.id === hit);
                  const draggedEl = currentReport().find((el) => el.id === draggedId);
                  if (hitRect) {
                    const vertical =
                      (hitEl && wSpanOf(hitEl) >= 6) ||
                      (draggedEl && wSpanOf(draggedEl) >= 6);
                    after = vertical
                      ? y > (hitRect.top + hitRect.bottom) / 2
                      : x > (hitRect.left + hitRect.right) / 2;
                  }
                }

                // 3) 드래그 중인 카드가 폭 6(가로 전체)이면 행 단위로 스냅
                //    — 앞 삽입이면 그 행의 맨 앞 카드 앞에, 뒤 삽입이면 맨 뒤 카드 뒤에
                if (hit) {
                  const draggedEl = currentReport().find((el) => el.id === draggedId);
                  if (draggedEl && wSpanOf(draggedEl) >= 6) {
                    const hitRect = dragSnapshot.current.get(hit);
                    if (hitRect) {
                      const rowY = (hitRect.top + hitRect.bottom) / 2;
                      const halfH = (hitRect.bottom - hitRect.top) / 2;
                      let edgeId: string = hit;
                      let edgeX = hitRect.left;
                      dragSnapshot.current.forEach((r, id) => {
                        if (id === draggedId) return;
                        const cardMidY = (r.top + r.bottom) / 2;
                        // 같은 행 (수직 중점 차이가 카드 높이 절반 이내)
                        if (Math.abs(cardMidY - rowY) < halfH + 4) {
                          if (after ? r.left > edgeX : r.left < edgeX) {
                            edgeId = id;
                            edgeX = r.left;
                          }
                        }
                      });
                      hit = edgeId;
                    }
                  }
                }

                if (hit !== overId || after !== overAfter) {
                  setOverId(hit);
                  setOverAfter(after);
                  // 이번 재정렬 시점의 커서 위치 저장 → 다음 재정렬은 임계값 이상 이동했을 때만
                  lastReorderPos.current = { x, y };
                }
              }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              if (draggedId) {
                commitReorder(e);
              } else {
                onDropNew(e);
              }
            }}
            className={
              "min-h-[320px] p-4 grid grid-cols-6 grid-flow-row-dense auto-rows-[96px] gap-3 content-start transition-colors " +
              (dragging ? "bg-blue-50" : "bg-white")
            }
          >
            {list.length === 0 ? (
              <div className="col-span-6 row-span-2 border-2 border-dashed rounded-md flex items-center justify-center text-xs text-gray-500">
                팔레트에서 요소를 이곳으로 끌어다 놓으세요
              </div>
            ) : (
              displayedList.map((e) => {
                const wSp = wSpanOf(e);
                const hSp = hSpanOf(e);
                const isDragging = draggedId === e.id;
                return (
                <div
                  key={e.id}
                  ref={(node) => {
                    if (node) cardRefs.current.set(e.id, node);
                    else cardRefs.current.delete(e.id);
                  }}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData("move", e.id);
                    ev.dataTransfer.effectAllowed = "move";
                    // 카드들의 현재 layout 좌표 스냅샷 (in-flight transform 제거 후)
                    cardRefs.current.forEach((el) => {
                      if (!el) return;
                      el.style.transition = "none";
                      el.style.transform = "";
                    });
                    const snap = new Map<string, DOMRect>();
                    cardRefs.current.forEach((el, cid) => {
                      if (el) snap.set(cid, el.getBoundingClientRect());
                    });
                    dragSnapshot.current = snap;
                    lastReorderPos.current = null;
                    setDraggedId(e.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setOverId(null);
                    setOverAfter(false);
                    dragSnapshot.current = new Map();
                    lastReorderPos.current = null;
                  }}
                  onDrop={(ev) => {
                    if (draggedId) commitReorder(ev);
                    else onDropNew(ev);
                  }}
                  style={{ gridColumn: `span ${wSp} / span ${wSp}`, gridRow: `span ${hSp} / span ${hSp}` }}
                  className={
                    "relative rounded border bg-white overflow-hidden flex flex-col min-h-0 " +
                    (isDragging ? "opacity-50 " : "")
                  }
                >
                  <div className="flex flex-wrap items-center gap-1 px-2 py-1 bg-gray-50 border-b text-[11px]">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mr-1">
                      {e.kind}
                      {e.ctype ? "·" + e.ctype : ""}
                    </span>
                    {e.kind !== "note" &&
                      e.kind !== "compare" &&
                      e.kind !== "fields" &&
                      e.kind !== "pathlabel" && (
                        <select
                          value={e.bind}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            // 제목이 팔레트 기본값이거나 이전 변수명 그대로면 새 변수명으로 함께 갱신
                            const isDefault =
                              !e.label ||
                              e.label === e.bind ||
                              PAL.some((p) => p.t === e.label);
                            updEl(e.id, isDefault && v ? { bind: v, label: v } : { bind: v });
                          }}
                          className="rounded border px-1 py-0.5 text-[11px] max-w-[130px]"
                        >
                          <option value="">(바인딩)</option>
                          <VarOptions names={allNames()} varsMeta={varsMeta} includeValue={e.bind} />
                        </select>
                      )}
                    {e.kind === "chart" && (
                      <select
                        value={e.ctype || "bar"}
                        onChange={(ev) => updEl(e.id, { ctype: ev.target.value as ChartType })}
                        className="rounded border px-1 py-0.5 text-[11px]"
                      >
                        <option value="bar">막대</option>
                        <option value="step">계단선</option>
                        <option value="donut">도넛</option>
                        <option value="gauge">게이지</option>
                        <option value="bullet">불릿</option>
                        <option value="stacked">누적 막대</option>
                        <option value="comparison">이중 막대</option>
                        <option value="delta">Δ 변화량</option>
                        <option value="ratio">비율 게이지</option>
                      </select>
                    )}
                    {e.kind === "chart" &&
                      (e.ctype === "bullet" ||
                        e.ctype === "comparison" ||
                        e.ctype === "delta" ||
                        e.ctype === "ratio") && (
                        <select
                          value={e.bind2 || ""}
                          onChange={(ev) => updEl(e.id, { bind2: ev.target.value })}
                          className="rounded border px-1 py-0.5 text-[11px] max-w-[120px]"
                          title={
                            e.ctype === "bullet"
                              ? "목표값"
                              : e.ctype === "comparison"
                              ? "비교 대상"
                              : e.ctype === "delta"
                              ? "이전값(전)"
                              : "분모(전체)"
                          }
                        >
                          <option value="">
                            (
                            {e.ctype === "bullet"
                              ? "목표값"
                              : e.ctype === "comparison"
                              ? "비교 대상"
                              : e.ctype === "delta"
                              ? "이전값"
                              : "분모"}
                            )
                          </option>
                          <VarOptions names={allNames()} varsMeta={varsMeta} includeValue={e.bind2} />
                        </select>
                      )}
                    <span className="font-mono text-[9px] text-gray-500 tabular-nums px-1.5 py-0.5 rounded bg-gray-100">
                      {wSp}×{hSp}
                    </span>
                    {/* 변수 설명 토글: 단일 bind 가 있는 종류만 노출 */}
                    {(e.kind === "field" ||
                      e.kind === "card" ||
                      e.kind === "calc" ||
                      e.kind === "incexc" ||
                      e.kind === "list" ||
                      e.kind === "chart") &&
                      e.bind && (
                        <label
                          className="inline-flex items-center gap-1 text-[10px] text-gray-600 cursor-pointer"
                          title="해당 변수/산출 설명 표시"
                        >
                          <input
                            type="checkbox"
                            checked={e.showDesc !== false}
                            onChange={(ev) =>
                              updEl(e.id, { showDesc: ev.target.checked })
                            }
                            className="accent-blue-600"
                          />
                          설명
                        </label>
                      )}
                    <button
                      onClick={() => delEl(e.id)}
                      className="ml-auto text-rose-600 font-semibold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-3 flex-1 overflow-hidden flex flex-col min-h-0">
                    {e.kind === "note" ? (
                      <NoteEdit
                        value={e.tpl || ""}
                        onChange={(tpl) => updEl(e.id, { tpl })}
                        names={allNames()}
                        varsMeta={varsMeta}
                        renderPreview={() => (
                          <ElementRenderer
                            schema={schema}
                            el={e}
                            sc={sc}
                            disp={disp}
                            jres={jres}
                            pathLabel={slots.find((s) => s.id === slot)?.label || ""}
                            pathConditions={
                              isFallbackSlot
                                ? fallback.conditions || []
                                : paths.find((p) => p.id === slot)?.conditions || []
                            }
                          />
                        )}
                      />
                    ) : e.kind === "fields" ? (
                      <FieldsEdit
                        binds={e.binds || []}
                        onChange={(binds) => updEl(e.id, { binds })}
                        names={allNames()}
                        disp={disp}
                        varsMeta={varsMeta}
                      />
                    ) : (
                      <ElementRenderer
                        schema={schema}
                        el={e}
                        sc={sc}
                        disp={disp}
                        jres={jres}
                        pathLabel={slots.find((s) => s.id === slot)?.label || ""}
                        pathConditions={
                          isFallbackSlot
                            ? fallback.conditions || []
                            : paths.find((p) => p.id === slot)?.conditions || []
                        }
                      />
                    )}
                  </div>
                  <div
                    onMouseDown={startResize(e.id)}
                    title="드래그하여 크기 조절"
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10 flex items-end justify-end pr-0.5 pb-0.5"
                  >
                    <span className="block w-2.5 h-2.5 border-r-2 border-b-2 border-gray-400 hover:border-blue-600" />
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="text-right text-xs font-mono text-gray-500">
        요소 {list.length}개 · 폭×높이 단위합 {unitsTotal} · 추정{" "}
        <span className={pages > 2 ? "text-rose-600 font-semibold" : ""}>
          {pages}페이지
        </span>{" "}
        (1~2페이지 권장)
      </div>
    </div>
    </>
  );
}

function FieldsEdit({
  binds,
  onChange,
  names,
  disp,
  varsMeta,
}: {
  binds: string[];
  onChange: (next: string[]) => void;
  names: string[];
  disp: Record<string, string>;
  varsMeta?: Record<string, { group?: string; subGroup?: string }>;
}) {
  const toggle = (n: string) => {
    onChange(binds.includes(n) ? binds.filter((x) => x !== n) : [...binds, n]);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= binds.length) return;
    const next = [...binds];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  return (
    <div className="space-y-2 text-xs">
      <div className="rounded border bg-white px-2.5 py-2">
        <div className="text-[10px] font-mono text-gray-500 mb-1">미리보기</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {binds.length === 0 && (
            <span className="text-[11px] text-gray-400">변수를 선택하세요</span>
          )}
          {binds.map((n, i) => (
            <span key={n} className="inline-flex items-center gap-1">
              <span className="text-[10px] font-mono text-gray-500">{n}</span>
              <b>{disp[n] ?? "—"}</b>
              {i < binds.length - 1 && <span className="text-gray-300 mx-1">|</span>}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-1">변수 선택 (클릭으로 추가/제거)</div>
        <div className="max-h-40 overflow-auto space-y-1.5">
          <GroupedVarChips
            names={names}
            varsMeta={varsMeta}
            isSelected={(n) => binds.includes(n)}
            onClick={toggle}
          />
        </div>
      </div>

      {binds.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 mb-1">순서</div>
          <div className="flex flex-wrap gap-1">
            {binds.map((n, i) => (
              <span
                key={n}
                className="inline-flex items-center rounded border bg-white text-[10px]"
              >
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                >
                  ◀
                </button>
                <span className="px-1.5 font-mono">{n}</span>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === binds.length - 1}
                  className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                >
                  ▶
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteEdit({
  value,
  onChange,
  names,
  renderPreview,
  varsMeta,
}: {
  value: string;
  onChange: (v: string) => void;
  names: string[];
  renderPreview: () => React.ReactNode;
  varsMeta?: Record<string, { group?: string; subGroup?: string }>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (name: string) => {
    const token = `{${name}}`;
    const el = ref.current;
    if (!el) {
      onChange((value || "") + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // 템플릿에서 실제 쓰인 이름들 (강조용)
  const used = new Set<string>();
  (value.match(/\{([^}]+)\}/g) || []).forEach((m) => used.add(m.slice(1, -1)));

  return (
    <>
      <textarea
        ref={ref}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        rows={2}
        placeholder="예) {성명} 님은 {적용여부}입니다."
        className="w-full rounded border px-2 py-1 text-xs font-mono shrink-0"
      />
      <div className="mt-1.5 shrink-0">
        <div className="text-[10px] text-gray-500 mb-1">
          사용 가능한 변수 (클릭하여 삽입)
        </div>
        <div className="max-h-32 overflow-auto space-y-1.5">
          {names.length === 0 ? (
            <span className="text-[10px] text-gray-400">변수가 없습니다.</span>
          ) : (
            <GroupedVarChips
              names={names}
              varsMeta={varsMeta}
              isSelected={(n) => used.has(n)}
              onClick={insert}
              chipTitle={(n) => `{${n}} 삽입`}
            />
          )}
        </div>
      </div>
      <div className="text-[10px] text-gray-400 mt-1.5 shrink-0">
        미리보기
      </div>
      <div className="mt-0.5 flex-1 overflow-auto min-h-0">{renderPreview()}</div>
    </>
  );
}

// 변수 옵션을 group > subGroup 계층으로 묶어 정렬해 렌더링.
// Tab3Logic 의 동작과 동일 — 드롭다운에서는 묶음 보이고, 선택 시엔 변수명만 표시됨.
function VarOptions({
  names,
  varsMeta,
  includeValue,
}: {
  names: string[];
  varsMeta?: Record<string, { group?: string; subGroup?: string }>;
  includeValue?: string;
}) {
  if (!varsMeta) {
    return (
      <>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {includeValue && !names.includes(includeValue) && (
          <option value={includeValue}>⚠ {includeValue} (정의 안됨)</option>
        )}
      </>
    );
  }
  const groups: Record<string, Record<string, string[]>> = {};
  const seen = new Set<string>();
  for (const nm of names) {
    if (seen.has(nm)) continue;
    seen.add(nm);
    const m = varsMeta[nm] || {};
    const g = (m.group || "").trim() || "_기타";
    const sg = (m.subGroup || "").trim() || "_기본";
    if (!groups[g]) groups[g] = {};
    if (!groups[g][sg]) groups[g][sg] = [];
    groups[g][sg].push(nm);
  }
  const hasReal = Object.keys(groups).some((g) => g !== "_기타");
  if (!hasReal) {
    return (
      <>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {includeValue && !names.includes(includeValue) && (
          <option value={includeValue}>⚠ {includeValue} (정의 안됨)</option>
        )}
      </>
    );
  }
  const sortedGroups = Object.entries(groups).sort(([a], [b]) =>
    a === "_기타" ? 1 : b === "_기타" ? -1 : a.localeCompare(b)
  );
  const out: any[] = [];
  for (const [g, subs] of sortedGroups) {
    const sortedSubs = Object.entries(subs).sort(([a], [b]) =>
      a === "_기본" ? -1 : b === "_기본" ? 1 : a.localeCompare(b)
    );
    for (const [sg, items] of sortedSubs) {
      const label =
        g === "_기타"
          ? sg === "_기본"
            ? "기타"
            : sg
          : sg === "_기본"
          ? g
          : `${g} > ${sg}`;
      out.push(
        <optgroup key={`${g}|${sg}`} label={label}>
          {items
            .sort((a, b) => a.localeCompare(b))
            .map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
        </optgroup>
      );
    }
  }
  if (includeValue) {
    const allNames = new Set<string>();
    for (const g of sortedGroups) for (const s of Object.values(g[1])) for (const it of s) allNames.add(it);
    if (!allNames.has(includeValue)) {
      out.push(
        <option key={"__custom__"} value={includeValue}>
          ⚠ {includeValue} (정의 안됨)
        </option>
      );
    }
  }
  return <>{out}</>;
}

export { VarOptions };

// 변수 칩(버튼) 리스트를 group > subGroup 계층으로 묶어 표시.
// FieldsEdit / NoteEdit 에서 사용.
function GroupedVarChips({
  names,
  varsMeta,
  isSelected,
  onClick,
  chipTitle,
}: {
  names: string[];
  varsMeta?: Record<string, { group?: string; subGroup?: string }>;
  isSelected: (name: string) => boolean;
  onClick: (name: string) => void;
  chipTitle?: (name: string) => string;
}) {
  const renderChip = (n: string) => {
    const on = isSelected(n);
    return (
      <button
        key={n}
        type="button"
        onClick={() => onClick(n)}
        title={chipTitle ? chipTitle(n) : undefined}
        className={
          "rounded-full px-1.5 py-0.5 text-[10px] border font-mono " +
          (on
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400")
        }
      >
        {n}
      </button>
    );
  };
  // 메타 없거나 모두 미분류면 평탄 표시
  const groups: Record<string, Record<string, string[]>> = {};
  const seen = new Set<string>();
  for (const nm of names) {
    if (seen.has(nm)) continue;
    seen.add(nm);
    const m = (varsMeta && varsMeta[nm]) || {};
    const g = (m.group || "").trim() || "_기타";
    const sg = (m.subGroup || "").trim() || "_기본";
    if (!groups[g]) groups[g] = {};
    if (!groups[g][sg]) groups[g][sg] = [];
    groups[g][sg].push(nm);
  }
  const hasReal = Object.keys(groups).some((g) => g !== "_기타");
  if (!hasReal) {
    return <div className="flex flex-wrap gap-1">{names.map(renderChip)}</div>;
  }
  const sortedGroups = Object.entries(groups).sort(([a], [b]) =>
    a === "_기타" ? 1 : b === "_기타" ? -1 : a.localeCompare(b)
  );
  return (
    <>
      {sortedGroups.map(([g, subs]) => {
        const sortedSubs = Object.entries(subs).sort(([a], [b]) =>
          a === "_기본" ? -1 : b === "_기본" ? 1 : a.localeCompare(b)
        );
        return (
          <div key={g} className="space-y-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
              {g === "_기타" ? "기타" : g}
            </div>
            {sortedSubs.map(([sg, items]) => (
              <div key={sg} className="pl-2">
                {sg !== "_기본" && (
                  <div className="text-[9px] text-gray-400 mb-0.5">{sg}</div>
                )}
                <div className="flex flex-wrap gap-1">
                  {items.sort((a, b) => a.localeCompare(b)).map(renderChip)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
