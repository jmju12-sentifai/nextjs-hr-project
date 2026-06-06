"use client";
import type { Meta } from "app-renderer";

interface Props {
  meta: Meta;
  onChange: (m: Meta) => void;
}

function TagList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const list = values.length ? values : [""];
  return (
    <div className="space-y-1.5">
      {list.map((v, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            value={v}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...list];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
            className="rounded border px-2 text-rose-600 hover:bg-rose-50"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...values, ""])}
        className="text-xs text-blue-700 hover:underline"
      >
        + 추가
      </button>
    </div>
  );
}

export default function Tab0Meta({ meta, onChange }: Props) {
  const set = <K extends keyof Meta>(k: K, v: Meta[K]) =>
    onChange({ ...meta, [k]: v });

  const lbl = "block mb-1.5 text-xs font-semibold tracking-wide text-gray-700";
  const inp = "w-full rounded border px-2 py-1.5 text-sm";

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-gray-100">
        <div className="text-xs font-mono uppercase tracking-wider text-blue-700 mb-2">
          메타 · MSaaS 설명 정의
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">앱 개요</h2>
        <p className="text-base text-gray-600 whitespace-nowrap overflow-x-auto">
          완제품 첫 화면과 리포트 머리글을 채우는 메타 정보 — 비워도 동작하지만 양산 시 앱 정체성이 됩니다.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 max-w-4xl pt-3">
        <div>
          <label className={lbl}>앱명 / 상단 타이틀</label>
          <input
            className={inp}
            value={meta.appName}
            onChange={(e) => set("appName", e.target.value)}
            placeholder="임금피크제 자동화 마이크로 SaaS 앱"
          />
        </div>
        <div>
          <label className={lbl}>서비스 한줄 설명</label>
          <input
            className={inp}
            value={meta.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="1명의 임직원 정보를 파싱하여 …"
          />
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>구축 목적</label>
          <textarea
            className={inp}
            rows={2}
            value={meta.purpose}
            onChange={(e) => set("purpose", e.target.value)}
            placeholder="무엇을 자동화하는 서비스인가"
          />
        </div>
        <div>
          <label className={lbl}>해결하려는 문제</label>
          <textarea
            className={inp}
            rows={2}
            value={meta.problem}
            onChange={(e) => set("problem", e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>대상 사용자</label>
          <textarea
            className={inp}
            rows={2}
            value={meta.users}
            onChange={(e) => set("users", e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>처리 흐름 4단계 (1 → 2 → 3 → 4)</label>
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((i) => {
              const flow = meta.flow && meta.flow.length === 4 ? meta.flow : ["", "", "", ""];
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shrink-0">
                    {i + 1}
                  </span>
                  <input
                    value={flow[i] || ""}
                    onChange={(e) => {
                      const next = [...flow];
                      next[i] = e.target.value;
                      set("flow", next);
                    }}
                    className="flex-1 rounded border px-2 py-1 text-sm"
                    placeholder={
                      [
                        "임금피크제 운영 세칙·기준 파일 지식화",
                        "임직원 인사·급여 데이터 파싱 및 정합성 확인",
                        "적용 여부·운영모델(가산/표준)·감액률 판단",
                        "최종 월기준액 산출 및 개인별 안내자료 생성",
                      ][i]
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>보안 / 클라우드 안내</label>
          <input
            className={inp}
            value={meta.security}
            onChange={(e) => set("security", e.target.value)}
            placeholder="개인정보 보호 · 보안 암호화 · 클라우드 기반"
          />
        </div>
        <div>
          <label className={lbl}>기대 효과 (카드)</label>
          <TagList
            values={meta.effects}
            onChange={(v) => set("effects", v)}
            placeholder="업무 시간 최대 90% 절감"
          />
        </div>
        <div>
          <label className={lbl}>핵심 특징</label>
          <TagList
            values={meta.features}
            onChange={(v) => set("features", v)}
            placeholder="모듈형 마이크로 SaaS"
          />
        </div>
      </div>
    </div>
  );
}
