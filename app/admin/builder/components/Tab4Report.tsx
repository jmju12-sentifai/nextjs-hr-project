"use client";
import { useEffect, useState } from "react";
import type { AppSchema } from "app-renderer";
import { migrateSchema } from "app-renderer";
import DocProposalEditor from "./DocProposalEditor";

interface Props {
  appId?: string | null;
  schema: AppSchema;
  onChange: (s: AppSchema) => void;
}

export default function Tab4Report({ schema, onChange, appId }: Props) {
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
  const [slotReady, setSlotReady] = useState(!appId);
  useEffect(() => {
    try {
      const remembered = appId && sessionStorage.getItem(`hrcoach:report-condition:${appId}`);
      if (remembered && slotIdsKey.split("|").includes(remembered)) setSlot(remembered);
    } catch { /* 저장 공간을 쓸 수 없어도 조건 선택은 가능하다. */ }
    setSlotReady(true);
  }, [appId, slotIdsKey]);

  useEffect(() => {
    if (!slotIdsKey.split("|").includes(slot)) {
      setSlot(slots[0]?.id || fallback.id);
    }
    // 슬롯 키 문자열 비교 → 같은 ids 일 땐 effect 가 다시 안 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIdsKey]);

  const isFallbackSlot = slot === fallback.id;
  const currentPath = (isFallbackSlot ? fallback : paths.find(p => p.id === slot)) || fallback;

  return <div className="space-y-5">
      {slots.length > 1 && <div role="group" aria-label="조건별 양식" className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">조건별 양식</span>
        {slots.map((s) => {
          const on = slot === s.id;
          return (
            <button
              key={s.id}
              aria-pressed={on}
              onClick={() => { setSlot(s.id); try { if (appId) sessionStorage.setItem(`hrcoach:report-condition:${appId}`, s.id); } catch { /* 현재 선택은 유지한다. */ } }}
              className={
                "rounded-lg px-3 py-2 text-sm transition " +
                (on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")
              }
            >
              <span className="font-medium">{s.label}</span>
            </button>
          );
        })}
      </div>}

      {slotReady && <DocProposalEditor key={slot} appId={appId} schema={m} path={currentPath}
        onApply={doc => {
          const next = { ...currentPath, doc };
          onChange(isFallbackSlot ? { ...m, fallback: next } : { ...m, paths: paths.map(p => p.id === slot ? next : p) });
        }} />}
    </div>;
}
