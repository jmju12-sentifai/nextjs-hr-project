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
}

const PAL: PaletteItem[] = [
  { kind: "field", t: "기본정보", s: "텍스트 한 줄" },
  { kind: "fields", t: "기본정보 묶음", s: "여러 변수를 가로로 (성명 홍길동 | 사번 …)" },
  { kind: "pathlabel", t: "경로 정보", s: "편집 중인 경로 라벨 (고정값)" },
  { kind: "card", t: "요약 카드", s: "핵심 결과 큰 숫자" },
  { kind: "compare", t: "판단 근거 비교표", s: "판정부 그대로" },
  { kind: "calc", t: "산출 근거", s: "계산식 + 결과값" },
  { kind: "incexc", t: "포함/제외 태그", s: "분류 단계 항목" },
  { kind: "chart", ctype: "bar", t: "구간 막대 차트", s: "구간표 → 막대" },
  { kind: "chart", ctype: "step", t: "구간 계단선", s: "연령별 감액률 등" },
  { kind: "chart", ctype: "donut", t: "포함/제외 도넛", s: "분류 비율" },
  { kind: "chart", ctype: "gauge", t: "게이지", s: "점수·등급의 위치" },
  { kind: "chart", ctype: "bullet", t: "불릿 차트", s: "목표 대비 실적" },
  { kind: "chart", ctype: "stacked", t: "누적 가로 막대", s: "분류 항목 비율" },
  { kind: "chart", ctype: "comparison", t: "이중 막대", s: "두 값 크기 비교" },
  { kind: "chart", ctype: "delta", t: "Δ 변화량", s: "전→후 증감 표시" },
  { kind: "chart", ctype: "ratio", t: "비율 게이지", s: "A / B 달성률" },
  { kind: "note", t: "안내문", s: "{변수}로 문장" },
];

const wDef: Record<ElementKind, Width> = {
  card: "third",
  field: "third",
  fields: "full",
  pathlabel: "full",
  compare: "full",
  calc: "half",
  incexc: "half",
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
  };

  const list = currentReport();

  // 드래그 중 가상 재정렬 — 다른 카드 위로 가면 미리 위치를 보여줌
  const displayedList: ReportElement[] = (() => {
    if (!draggedId || !overId || draggedId === overId) return list;
    const from = list.findIndex((x) => x.id === draggedId);
    const to = list.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0) return list;
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
  const pages = Math.max(1, Math.ceil(unitsTotal / 12));
  const isActivePath = result.activePathId === slot;

  return (
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

      {/* 경로 선택 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 border p-2">
        <span className="text-xs font-semibold text-gray-700 px-1.5">
          편집 중인 경로:
        </span>
        {slots.map((s) => {
          const matched = result.activePathId === s.id;
          const on = slot === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSlot(s.id)}
              className={
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                (on
                  ? s.isFallback
                    ? "bg-rose-600 text-white"
                    : "bg-blue-600 text-white"
                  : s.isFallback
                  ? "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
                  : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50") +
                (matched ? " ring-2 ring-emerald-400 ring-offset-1" : "")
              }
            >
              {s.isFallback && "▣ "}
              {s.label}
              {matched && <span className="text-[10px] opacity-70">활성</span>}
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
        <div className="rounded border bg-gray-50 p-3 self-start sticky top-2 max-h-[calc(100vh-40px)] overflow-auto">
          <h3 className="text-xs font-semibold tracking-wide text-gray-700 mb-1">
            요소 팔레트
          </h3>
          <div className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded text-center mb-3">
            ↓ 우측 캔버스로 끌어다 놓으세요
          </div>
          {PAL.map((p) => {
            const key = p.kind + (p.ctype ? "|" + p.ctype : "");
            return (
              <div
                key={key}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("new", key)}
                onClick={() => addEl(p)}
                className="rounded border bg-white p-2 mb-1.5 cursor-grab hover:border-blue-600 hover:shadow-sm transition"
                title="클릭 또는 드래그"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-[10px]">⋮⋮</span>
                  <span className="text-xs font-semibold">{p.t}</span>
                </div>
                <div className="text-[10px] text-gray-500 ml-4">{p.s}</div>
              </div>
            );
          })}
        </div>

        {/* canvas */}
        <div className="border rounded bg-white overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2.5 text-sm flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold">
              📄 {slots.find((s) => s.id === slot)?.label} — 리포트 미리보기
            </span>
            <span className="text-[10px] font-mono opacity-70">
              ⇕ 드래그 이동 · 우하단 ⌟ 드래그로 크기 조절 · ✕ 삭제
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

                // 1) 정확한 사각형 내부 hit 우선
                dragSnapshot.current.forEach((r, id) => {
                  if (id === draggedId) return;
                  if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                    hit = id;
                  }
                });

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

                // 3) 드래그 중인 카드가 폭 6(가로 전체)이면, 타겟이 속한 행의 "맨 앞" 카드로 스냅
                //    — dense 자동 채우기로 좁은 카드들이 backfill 되는 것을 막음
                if (hit) {
                  const draggedEl = currentReport().find((x) => x.id === draggedId);
                  if (draggedEl && wSpanOf(draggedEl) >= 6) {
                    const hitRect = dragSnapshot.current.get(hit);
                    if (hitRect) {
                      const rowY = (hitRect.top + hitRect.bottom) / 2;
                      let leftmostId = hit;
                      let leftmostX = hitRect.left;
                      dragSnapshot.current.forEach((r, id) => {
                        if (id === draggedId) return;
                        const cardMidY = (r.top + r.bottom) / 2;
                        // 같은 행 (수직 중점 차이가 카드 높이 절반 이내)
                        const halfH = (hitRect.bottom - hitRect.top) / 2;
                        if (Math.abs(cardMidY - rowY) < halfH + 4 && r.left < leftmostX) {
                          leftmostId = id;
                          leftmostX = r.left;
                        }
                      });
                      hit = leftmostId;
                    }
                  }
                }

                if (hit !== overId) {
                  setOverId(hit);
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
                          onChange={(ev) => updEl(e.id, { bind: ev.target.value })}
                          className="rounded border px-1 py-0.5 text-[11px] max-w-[130px]"
                        >
                          <option value="">(바인딩)</option>
                          {allNames().map((n) => (
                            <option key={n}>{n}</option>
                          ))}
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
                          {allNames().map((n) => (
                            <option key={n}>{n}</option>
                          ))}
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
  );
}

function FieldsEdit({
  binds,
  onChange,
  names,
  disp,
}: {
  binds: string[];
  onChange: (next: string[]) => void;
  names: string[];
  disp: Record<string, string>;
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
        <div className="flex flex-wrap gap-1 max-h-20 overflow-auto">
          {names.map((n) => {
            const on = binds.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
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
          })}
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
}: {
  value: string;
  onChange: (v: string) => void;
  names: string[];
  renderPreview: () => React.ReactNode;
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
        <div className="flex flex-wrap gap-1 max-h-16 overflow-auto">
          {names.length === 0 && (
            <span className="text-[10px] text-gray-400">변수가 없습니다.</span>
          )}
          {names.map((n) => {
            const on = used.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => insert(n)}
                title={`{${n}} 삽입`}
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
          })}
        </div>
      </div>
      <div className="text-[10px] text-gray-400 mt-1.5 shrink-0">
        미리보기
      </div>
      <div className="mt-0.5 flex-1 overflow-auto min-h-0">{renderPreview()}</div>
    </>
  );
}
