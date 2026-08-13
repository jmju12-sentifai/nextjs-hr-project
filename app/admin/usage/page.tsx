"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// 관리자 · 토큰 사용량 — 요금제 산정용
//   데이터는 /api/admin/usage 가 service_role 로 집계해 내려준다 (브라우저는 DB 직접 접근 없음).
//   원가(₩) 환산은 이 화면에서 한다 — 모델 단가는 관리자가 입력하고 브라우저에 저장한다.
//   (단가 테이블을 DB 에 두려면 마이그레이션이 또 필요해, 우선 화면 설정으로 시작한다)

type Split = {
  calls: number; promptTokens: number; outputTokens: number; totalTokens: number;
  appCalls: number; appPromptTokens: number; appOutputTokens: number; appTokens: number;
  builderCalls: number; builderPromptTokens: number; builderOutputTokens: number; builderTokens: number;
};
type Totals = Split & {
  errorCalls: number; runs: number; instrumentedRuns: number; users: number; apps: number;
};
type Derived = {
  endUserCount: number;
  medianTokensPerUser: number; p90TokensPerUser: number; maxTokensPerUser: number;
  tokensPerRun: number | null; promptPerRun: number | null; outputPerRun: number | null;
  top10SharePct: number; instrumentedFrom: string | null;
  periodDays: number; monthFactor: number;
};
type UserRow = Split & {
  userId: string | null; email: string | null; isAdmin: boolean; subscription: string | null;
  errorCalls: number; runs: number; appCount: number; apps: string[]; lastUsedAt: string | null;
};
type AppRow = Split & {
  appId: string | null; name: string; status: string | null;
  runs: number; instrumentedRuns: number; users: number;
  tokensPerRun: number | null; promptPerRun: number | null; outputPerRun: number | null;
};
type ModelRow = Split & { model: string; errorCalls: number; avgDurationMs: number | null };
type SurfaceRow = {
  surface: string; calls: number; promptTokens: number; outputTokens: number;
  totalTokens: number; users: number;
};
type OpRow = {
  surface: string; operation: string; calls: number;
  promptTokens: number; outputTokens: number; totalTokens: number;
};
type MonthRow = Split & { month: string; runs: number; users: number };
type UserAppRow = Split & {
  userId: string | null; email: string | null; isAdmin: boolean;
  appId: string | null; appName: string; runs: number; lastUsedAt: string | null;
};
type EndUser = { email: string | null; prompt: number; output: number; total: number };

type Payload = {
  range: { from: string; to: string; days: number };
  totals: Totals; derived: Derived;
  byUser: UserRow[]; byApp: AppRow[]; byUserApp: UserAppRow[]; byModel: ModelRow[];
  bySurface: SurfaceRow[]; byOperation: OpRow[]; byMonth: MonthRow[];
  endUserTokens: EndUser[];
  truncated: boolean;
};

// ── 단가 설정 ───────────────────────────────────────────────
// Google 가격표는 USD / 100만 토큰 기준이라 그대로 입력하고 환율만 곱한다.
type Pricing = { inUsd: number; outUsd: number; fx: number };
const PRICING_KEY = "hrcoach.usage.pricing.v1";
const emptyPricing: Pricing = { inUsd: 0, outUsd: 0, fx: 0 };
const hasPricing = (p: Pricing) => p.fx > 0 && (p.inUsd > 0 || p.outUsd > 0);

/** 입력·출력 토큰 → 원. 단가가 없으면 null (— 로 표시) */
function wonOf(prompt: number, output: number, p: Pricing): number | null {
  if (!hasPricing(p)) return null;
  return ((prompt / 1e6) * p.inUsd + (output / 1e6) * p.outUsd) * p.fx;
}

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Math.round(v).toLocaleString("ko-KR");
/** 원 표시 — 1원 미만도 버려지지 않게 소수점을 살린다 (Flash 계열은 건당 원 단위가 흔하다) */
const won = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0원";
  if (v < 1) return `${v.toFixed(2)}원`;
  if (v < 100) return `${v.toFixed(1)}원`;
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
};

const OP_LABEL: Record<string, string> = {
  llm_summary: "안내문 생성", parse_document: "개인정보 파싱",
  generate_spec: "기획서 생성", spec_stage: "기획서 단계 분석",
  spec_preview: "탭별 프리뷰", parse_spec: "기획서 파싱",
  unattributed: "⚠ 미분류",
};
const SURFACE_LABEL: Record<string, string> = { app: "사용자 앱", builder: "관리자 빌더" };

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" }); // 엑셀 한글 깨짐 방지
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function UsagePage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"user" | "app" | "model" | "surface" | "month">("user");

  const [pricing, setPricing] = useState<Pricing>(emptyPricing);
  const [priceOpen, setPriceOpen] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(0);

  // 단가·구독료는 브라우저에 저장 (DB 마이그레이션 없이 바로 쓰기 위함)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRICING_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        setPricing({ inUsd: +j.inUsd || 0, outUsd: +j.outUsd || 0, fx: +j.fx || 0 });
        setMonthlyFee(+j.monthlyFee || 0);
      }
    } catch {}
  }, []);
  const savePricing = (p: Pricing, fee: number) => {
    setPricing(p);
    setMonthlyFee(fee);
    try {
      localStorage.setItem(PRICING_KEY, JSON.stringify({ ...p, monthlyFee: fee }));
    } catch {}
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/usage?days=${days}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "조회 실패");
      setData(j as Payload);
    } catch (e: any) {
      setErr(e?.message || "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const priced = hasPricing(pricing);

  // ── 요금제 시뮬레이션 ─────────────────────────────────────
  // 조회 기간이 30일이 아닐 수 있으므로 월 단위로 환산해서 비교한다.
  const sim = useMemo(() => {
    if (!data || !priced) return null;
    const f = data.derived.monthFactor;
    const costs = data.endUserTokens
      .map((u) => ({ email: u.email, won: (wonOf(u.prompt, u.output, pricing) || 0) * f }))
      .sort((a, b) => a.won - b.won);
    if (costs.length === 0)
      return { costs, median: 0, p90: 0, max: 0, avg: 0, loss: 0, margin: null as number | null };
    const at = (p: number) => costs[Math.min(costs.length - 1, Math.floor((costs.length - 1) * p))].won;
    const avg = costs.reduce((a, c) => a + c.won, 0) / costs.length;
    const loss = monthlyFee > 0 ? costs.filter((c) => c.won > monthlyFee).length : 0;
    return {
      costs, median: at(0.5), p90: at(0.9), max: costs[costs.length - 1].won, avg, loss,
      margin: monthlyFee > 0 ? ((monthlyFee - avg) / monthlyFee) * 100 : null,
    };
  }, [data, pricing, priced, monthlyFee]);

  const exportCsv = () => {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const c = (p: number, o: number) => (priced ? Math.round((wonOf(p, o, pricing) || 0) * 100) / 100 : "");
    if (tab === "user") {
      // 엑셀 피벗에 바로 넣을 수 있도록 '사용자 × 앱' 평면 교차표로 내보낸다
      const subOf = new Map(data.byUser.map((u) => [u.userId ?? "?", u.subscription ?? ""]));
      downloadCsv(`토큰사용량_사용자별앱_${stamp}.csv`,
        ["이메일","구분","구독","앱","실행","호출","사용자 토큰","관리자 토큰","입력 토큰","출력 토큰","총 토큰","원가(원)","마지막 사용"],
        data.byUserApp.map((x) => [
          x.email ?? "(알 수 없음)", x.isAdmin ? "관리자" : "사용자", subOf.get(x.userId ?? "?") ?? "",
          x.appName, x.runs, x.calls, x.appTokens, x.builderTokens,
          x.promptTokens, x.outputTokens, x.totalTokens, c(x.promptTokens, x.outputTokens),
          x.lastUsedAt?.slice(0, 19).replace("T", " ") ?? "",
        ]));
    } else if (tab === "app") {
      downloadCsv(`토큰사용량_앱별_${stamp}.csv`,
        ["앱","상태","사용자 수","실행","호출","사용자 토큰","관리자 토큰","총 토큰","실행당 토큰","실행당 원가(원)","총 원가(원)"],
        data.byApp.map((a) => [
          a.name, a.status ?? "", a.users, a.runs, a.calls, a.appTokens, a.builderTokens, a.totalTokens,
          a.tokensPerRun ?? "",
          priced && a.promptPerRun != null
            ? Math.round((wonOf(a.promptPerRun, a.outputPerRun || 0, pricing) || 0) * 100) / 100
            : "",
          c(a.promptTokens, a.outputTokens),
        ]));
    } else if (tab === "model") {
      downloadCsv(`토큰사용량_모델별_${stamp}.csv`,
        ["모델","호출","오류","입력 토큰","출력 토큰","총 토큰","원가(원)","평균 소요(ms)"],
        data.byModel.map((m) => [
          m.model, m.calls, m.errorCalls, m.promptTokens, m.outputTokens, m.totalTokens,
          c(m.promptTokens, m.outputTokens), m.avgDurationMs ?? "",
        ]));
    } else if (tab === "month") {
      downloadCsv(`토큰사용량_월별_${stamp}.csv`,
        ["월","사용자 수","실행","호출","사용자 토큰","관리자 토큰","총 토큰","원가(원)"],
        data.byMonth.map((m) => [
          m.month, m.users, m.runs, m.calls, m.appTokens, m.builderTokens, m.totalTokens,
          c(m.promptTokens, m.outputTokens),
        ]));
    } else {
      downloadCsv(`토큰사용량_구분별_${stamp}.csv`,
        ["구분","작업","호출","입력 토큰","출력 토큰","총 토큰","원가(원)"],
        data.byOperation.map((o) => [
          SURFACE_LABEL[o.surface] ?? o.surface, OP_LABEL[o.operation] ?? o.operation,
          o.calls, o.promptTokens, o.outputTokens, o.totalTokens, c(o.promptTokens, o.outputTokens),
        ]));
    }
  };

  const empty = !!data && data.totals.calls === 0 && data.totals.runs === 0;
  const totalWon = data ? wonOf(data.totals.promptTokens, data.totals.outputTokens, pricing) : null;
  const appWon = data ? wonOf(data.totals.appPromptTokens, data.totals.appOutputTokens, pricing) : null;
  const builderWon = data ? wonOf(data.totals.builderPromptTokens, data.totals.builderOutputTokens, pricing) : null;
  const perRunWon =
    data && data.derived.promptPerRun != null
      ? wonOf(data.derived.promptPerRun, data.derived.outputPerRun || 0, pricing)
      : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 pt-10 pb-14 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-blue-700 font-mono mb-1.5">
              관리자 · 사용량
            </div>
            <h1 className="text-2xl font-bold text-gray-900">토큰 사용량 · 원가</h1>
            <p className="mt-1 text-sm text-gray-500">
              사용자별·앱별·모델별 LLM 사용량과 원가. 요금제 기준을 잡는 데 씁니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700"
            >
              <option value={7}>최근 7일</option>
              <option value={30}>최근 30일</option>
              <option value={90}>최근 90일</option>
              <option value={365}>최근 1년</option>
              <option value={3650}>전체</option>
            </select>
            <button
              onClick={() => setPriceOpen((v) => !v)}
              className={
                "rounded-lg border px-3 py-2 text-xs transition " +
                (priced
                  ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  : "border-amber-300 bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100")
              }
            >
              {priced ? "⚙ 단가" : "⚠ 단가 설정 필요"}
            </button>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ↻ 새로고침
            </button>
            <button
              onClick={exportCsv}
              disabled={!data || empty}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              ⬇ CSV
            </button>
            <Link href="/admin/applist" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition">
              앱 리스트
            </Link>
          </div>
        </div>

        {(priceOpen || (!priced && !!data && !empty)) && (
          <PricingPanel
            pricing={pricing}
            monthlyFee={monthlyFee}
            onSave={savePricing}
            onClose={() => setPriceOpen(false)}
            models={data?.byModel.map((m) => m.model) ?? []}
          />
        )}

        {err && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
        )}
        {data?.truncated && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            데이터가 집계 상한(10만 행)을 넘어 일부만 반영됐습니다. 기간을 좁히거나 SQL 집계 뷰로 옮겨야 합니다.
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">불러오는 중…</div>
        ) : empty ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-sm text-gray-700 font-medium">이 기간에 기록된 사용량이 없습니다.</div>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              토큰 기록은 계측을 넣은 시점부터 쌓입니다. 그 이전 호출은 소급되지 않습니다.
              <br />운영 환경이라면 <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> 가 설정돼 있는지 확인하세요.
            </p>
          </div>
        ) : data ? (
          <>
            <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card
                label="총 원가"
                value={priced ? won(totalWon) : n(data.totals.totalTokens)}
                sub={priced ? `${n(data.totals.totalTokens)} 토큰` : "단가 미설정 — 토큰 수"}
                tone={priced ? undefined : "warn"}
                big
              />
              <Card
                label="사용자 사용분"
                value={priced ? won(appWon) : n(data.totals.appTokens)}
                sub={`호출 ${n(data.totals.appCalls)} · 요금제 계산의 기준`}
              />
              <Card
                label="관리자 구축분"
                value={priced ? won(builderWon) : n(data.totals.builderTokens)}
                sub={`호출 ${n(data.totals.builderCalls)} · 앱당 1회성`}
              />
              <Card
                label="사용자"
                value={n(data.totals.users)}
                sub={`실사용자 ${n(data.derived.endUserCount)}명 · 앱 ${n(data.totals.apps)}개`}
              />
            </div>

            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="text-[11px] font-bold tracking-wider text-blue-800 mb-3">
                요금제 산정 &nbsp;·&nbsp; 관리자 구축분을 제외한 실사용자 기준 · 30일 환산
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Metric
                  label="실행 1건당"
                  value={priced ? won(perRunWon) : n(data.derived.tokensPerRun)}
                  hint={
                    data.derived.tokensPerRun == null
                      ? "계측 이후 실행 0건 — 아직 산출 불가"
                      : `${n(data.derived.tokensPerRun)} 토큰 · 계측 후 ${n(data.totals.instrumentedRuns)}건`
                  }
                />
                <Metric
                  label="사용자당 월 원가 (중앙값)"
                  value={sim ? won(sim.median) : priced ? "—" : n(data.derived.medianTokensPerUser)}
                  hint="정액제 손익분기"
                />
                <Metric
                  label="사용자당 월 원가 (p90)"
                  value={sim ? won(sim.p90) : priced ? "—" : n(data.derived.p90TokensPerUser)}
                  hint={sim && sim.max ? `최대 ${won(sim.max)}` : "상위권도 흑자인지"}
                />
                <Metric
                  label="상위 10% 비중"
                  value={`${data.derived.top10SharePct}%`}
                  hint="50% 넘으면 사용량 상한 필요"
                />
              </div>

              <div className="mt-3 pt-3 border-t border-blue-200/70">
                <div className="flex items-center gap-2 flex-wrap text-xs text-blue-900">
                  <span className="font-semibold">월 구독료를 넣어 보세요</span>
                  <input
                    type="number"
                    value={monthlyFee || ""}
                    onChange={(e) => savePricing(pricing, parseFloat(e.target.value) || 0)}
                    placeholder="예: 49000"
                    className="w-28 rounded border border-blue-200 px-2 py-1 text-right tabular-nums"
                  />
                  <span>원 / 월</span>
                  {!priced && <span className="text-amber-700">— 단가를 먼저 설정하세요</span>}
                  {priced && monthlyFee > 0 && sim && sim.costs.length > 0 && (
                    <span className="ml-2">
                      LLM 마진{" "}
                      <b className={sim.margin! < 0 ? "text-rose-600" : "text-emerald-700"}>
                        {sim.margin!.toFixed(1)}%
                      </b>
                      {" · "}적자 사용자{" "}
                      <b className={sim.loss > 0 ? "text-rose-600" : "text-emerald-700"}>
                        {sim.loss}명 / {sim.costs.length}명
                      </b>
                    </span>
                  )}
                  {priced && monthlyFee > 0 && (!sim || sim.costs.length === 0) && (
                    <span className="ml-2 text-blue-700/70">실사용자 데이터가 아직 없어 계산할 수 없습니다</span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-blue-900/70 leading-relaxed">
                  여기 원가는 <b>LLM 토큰 비용만</b>입니다 — 서버·DB·인건비는 빠져 있습니다.
                  Flash 계열은 매우 저렴해 원가가 가격을 정해주지 않습니다.
                  이 숫자는 <b>손실 방지 하한선</b>과 <b>남용 탐지</b>에 쓰고,
                  가격 자체는 &lsquo;담당자 수작업 몇 시간을 줄여주는가&rsquo;로 정하세요.
                </p>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 p-1 w-fit shadow-sm flex-wrap">
              {([
                { k: "user", label: "사용자별", n: data.byUser.length },
                { k: "app", label: "앱별", n: data.byApp.length },
                { k: "month", label: "월별 추이", n: data.byMonth.length },
                { k: "model", label: "모델별", n: data.byModel.length },
                { k: "surface", label: "관리자 / 사용자", n: data.byOperation.length },
              ] as const).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={
                    "px-3 py-1.5 text-xs rounded-md transition " +
                    (tab === t.k ? "bg-blue-600 text-white font-semibold" : "text-gray-600 hover:bg-gray-100")
                  }
                >
                  {t.label}
                  <span className={"ml-1.5 inline-flex items-center justify-center min-w-[18px] px-1 rounded-full text-[10px] " + (tab === t.k ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600")}>
                    {t.n}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                {tab === "user" && <UserTable rows={data.byUser} cross={data.byUserApp} pricing={pricing} priced={priced} />}
                {tab === "app" && <AppTable rows={data.byApp} cross={data.byUserApp} pricing={pricing} priced={priced} />}
                {tab === "month" && <MonthTable rows={data.byMonth} pricing={pricing} priced={priced} />}
                {tab === "model" && <ModelTable rows={data.byModel} pricing={pricing} priced={priced} />}
                {tab === "surface" && <SurfaceTable surfaces={data.bySurface} ops={data.byOperation} pricing={pricing} priced={priced} />}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-gray-400">
              기간 {data.range.from.slice(0, 10)} ~ {data.range.to.slice(0, 10)} ({data.derived.periodDays}일)
              {data.derived.instrumentedFrom
                ? ` · 토큰 계측 시작 ${data.derived.instrumentedFrom.slice(0, 10)} — 그 이전 실행은 토큰 기록이 없어 단가 분모에서 제외됩니다.`
                : " · 아직 토큰 기록이 없습니다."}
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}

// ── 단가 설정 패널 ─────────────────────────────────────────
function PricingPanel({
  pricing, monthlyFee, onSave, onClose, models,
}: {
  pricing: Pricing; monthlyFee: number;
  onSave: (p: Pricing, fee: number) => void; onClose: () => void; models: string[];
}) {
  const [inUsd, setIn] = useState(String(pricing.inUsd || ""));
  const [outUsd, setOut] = useState(String(pricing.outUsd || ""));
  const [fx, setFx] = useState(String(pricing.fx || ""));
  useEffect(() => {
    setIn(String(pricing.inUsd || ""));
    setOut(String(pricing.outUsd || ""));
    setFx(String(pricing.fx || ""));
  }, [pricing]);

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-amber-900 mb-1">모델 단가 설정</div>
          <p className="text-[11px] text-amber-900/80 leading-relaxed max-w-2xl">
            Google 공식 가격표의 <b>USD / 100만 토큰</b> 값을 그대로 넣으세요.
            {models.length > 0 && (
              <> 지금 쓰이는 모델: <span className="font-mono font-semibold">{models.join(", ")}</span></>
            )}
            <br />
            <span className="text-amber-800/70">
              모델이 둘 이상이면 이 단가가 전부에 똑같이 적용됩니다 — 모델별 단가 분리가 필요해지면 알려 주세요.
            </span>
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-amber-800 hover:underline">닫기</button>
      </div>
      <div className="mt-3 flex items-end gap-3 flex-wrap">
        <Field label="입력 단가" suffix="USD / 1M" value={inUsd} onChange={setIn} placeholder="0.30" />
        <Field label="출력 단가" suffix="USD / 1M" value={outUsd} onChange={setOut} placeholder="2.50" />
        <Field label="환율" suffix="원 / USD" value={fx} onChange={setFx} placeholder="1400" />
        <button
          onClick={() => onSave({ inUsd: +inUsd || 0, outUsd: +outUsd || 0, fx: +fx || 0 }, monthlyFee)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
        >
          저장
        </button>
        {hasPricing(pricing) && (
          <span className="text-[11px] text-amber-900/70">
            현재 적용: 입력 ${pricing.inUsd} · 출력 ${pricing.outUsd} · 환율 {pricing.fx.toLocaleString("ko-KR")}원
          </span>
        )}
      </div>
      <p className="mt-2 text-[10px] text-amber-800/70">
        placeholder 는 형식 예시일 뿐 실제 단가가 아닙니다 — 반드시 Google 가격표에서 확인해 입력하세요.
        이 값은 브라우저에만 저장됩니다(다른 기기에서는 다시 입력).
      </p>
    </div>
  );
}

function Field({ label, suffix, value, onChange, placeholder }: {
  label: string; suffix: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <label className="block">
      <div className="text-[10px] text-amber-900/80 mb-1">{label}</div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-24 rounded border border-amber-300 bg-white px-2 py-1.5 text-xs text-right tabular-nums"
        />
        <span className="text-[10px] text-amber-800/70 whitespace-nowrap">{suffix}</span>
      </div>
    </label>
  );
}

function Card({ label, value, sub, tone, big }: {
  label: string; value: string; sub?: string; tone?: "warn"; big?: boolean;
}) {
  return (
    <div className={"rounded-xl border bg-white p-4 shadow-sm " + (big ? "border-blue-300" : "border-gray-200")}>
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className={"font-bold tabular-nums text-2xl " + (big ? "text-blue-800" : "text-gray-900")}>{value}</div>
      {sub && <div className={"mt-1 text-[11px] " + (tone === "warn" ? "text-amber-700" : "text-gray-400")}>{sub}</div>}
    </div>
  );
}
function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] text-blue-800/80 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-blue-900 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-blue-700/60 mt-0.5">{hint}</div>}
    </div>
  );
}

const TH = "text-left px-3 py-2.5 font-semibold text-gray-600 text-[11px] whitespace-nowrap";
const TD = "px-3 py-2.5 text-gray-700 whitespace-nowrap";
const NUM = TD + " text-right tabular-nums";
const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="border-t border-gray-100 px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed">{children}</div>
);


/** 펼침 시 한 번에 보이는 최대 줄 수 — 넘으면 안에서 스크롤 */
const CROSS_MAX = 10;
/** 한 줄 높이(px) — max-height 계산용. 아래 py-1.5 + text-[11px] 기준 */
const CROSS_ROW_H = 28;

/** 드릴다운 하위 표 — 사용자↔앱 어느 방향에서든 같은 데이터를 쓴다 */
function CrossRows({ rows, label, pricing, priced, cols }: {
  rows: UserAppRow[]; label: (r: UserAppRow) => string;
  pricing: Pricing; priced: boolean; cols: number;
}) {
  if (rows.length === 0)
    return (
      <tr className="bg-slate-50/70">
        <td colSpan={cols} className="px-3 py-2 pl-10 text-[11px] text-gray-400">내역 없음</td>
      </tr>
    );
  const scroll = rows.length > CROSS_MAX;
  return (
    <tr className="bg-slate-50/70">
      <td colSpan={cols} className="p-0">
        <div
          className={"ml-7 border-l-2 border-blue-200" + (scroll ? " overflow-y-auto" : "")}
          style={scroll ? { maxHeight: CROSS_MAX * CROSS_ROW_H } : undefined}
        >
          {rows.map((x, i) => (
            <div
              key={(x.userId || "") + (x.appId || "") + i}
              className="flex items-center gap-3 py-1.5 pl-3 pr-3 text-[11px] hover:bg-white/70"
            >
              <span className="flex-1 min-w-0 truncate text-gray-700">{label(x)}</span>
              <span className="tabular-nums text-gray-500 w-16 text-right shrink-0">실행 {n(x.runs)}</span>
              <span className="tabular-nums text-gray-500 w-16 text-right shrink-0">호출 {n(x.calls)}</span>
              <span className="tabular-nums text-blue-700 w-24 text-right shrink-0">
                {x.appTokens > 0 ? n(x.appTokens) + " 사용자" : <span className="text-gray-300">—</span>}
              </span>
              <span className="tabular-nums text-violet-700 w-24 text-right shrink-0">
                {x.builderTokens > 0 ? n(x.builderTokens) + " 관리자" : <span className="text-gray-300">—</span>}
              </span>
              <span className="tabular-nums font-semibold text-gray-900 w-16 text-right shrink-0">
                {priced ? won(wonOf(x.promptTokens, x.outputTokens, pricing)) : "—"}
              </span>
              <span className="tabular-nums text-gray-400 w-20 text-right shrink-0">
                {x.lastUsedAt?.slice(5, 10) ?? "—"}
              </span>
            </div>
          ))}
        </div>
        {scroll && (
          <div className="ml-7 pl-3 py-1 text-[10px] text-gray-400 border-l-2 border-blue-200">
            전체 {rows.length}개 · 위 목록을 스크롤하면 나머지 {rows.length - CROSS_MAX}개가 보입니다
          </div>
        )}
      </td>
    </tr>
  );
}

function UserTable({ rows, cross, pricing, priced }: {
  rows: UserRow[]; cross: UserAppRow[]; pricing: Pricing; priced: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((prev) => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s });
  return (
    <>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className={TH}>사용자</th>
            <th className={TH}>구독</th>
            <th className={TH + " text-right"}>쓴 앱</th>
            <th className={TH + " text-right"}>실행</th>
            <th className={TH + " text-right text-blue-700"}>사용자 토큰</th>
            <th className={TH + " text-right text-violet-700"}>관리자 토큰</th>
            <th className={TH + " text-right"}>총 토큰</th>
            <th className={TH + " text-right"}>원가</th>
            <th className={TH}>마지막 사용</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((u, i) => {
            const key = (u.userId || "u") + i;
            const mine = cross
              .filter((x) => (x.userId || "?") === (u.userId || "?"))
              .sort((a, b) => b.totalTokens - a.totalTokens || b.runs - a.runs);
            const isOpen = open.has(key);
            return (
            <React.Fragment key={key}>
            <tr onClick={() => toggle(key)} className="hover:bg-blue-50/50 cursor-pointer">
              <td className={TD}>
                <div className="flex items-center gap-1.5">
                  <span className={"text-gray-400 transition-transform " + (isOpen ? "rotate-90" : "")}>▸</span>
                  <span className="font-medium text-gray-900">{u.email || "(알 수 없음)"}</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 pl-4">
                  앱 {u.appCount}개 · 클릭하면 앱별 내역
                </div>
              </td>
              <td className={TD}>
                {u.isAdmin ? (
                  <span className="inline-block rounded px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-semibold">관리자</span>
                ) : u.subscription ? (
                  <span className="inline-block rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px]">{u.subscription}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className={NUM}>{u.appCount}</td>
              <td className={NUM}>{n(u.runs)}</td>
              <td className={NUM + " text-blue-700"}>{u.appTokens > 0 ? n(u.appTokens) : <span className="text-gray-300">—</span>}</td>
              <td className={NUM + " text-violet-700"}>{u.builderTokens > 0 ? n(u.builderTokens) : <span className="text-gray-300">—</span>}</td>
              <td className={NUM}>{n(u.totalTokens)}</td>
              <td className={NUM + " font-semibold text-gray-900"}>
                {priced ? won(wonOf(u.promptTokens, u.outputTokens, pricing)) : <span className="text-gray-300">—</span>}
              </td>
              <td className={TD + " text-gray-400"}>{u.lastUsedAt?.slice(0, 16).replace("T", " ") || "—"}</td>
            </tr>
            {isOpen && (
              <CrossRows rows={mine} label={(x) => x.appName} pricing={pricing} priced={priced} cols={9} />
            )}
            </React.Fragment>
          )})}
        </tbody>
      </table>
      <Note>
        <b>행을 클릭하면</b> 그 사용자가 어느 앱을 얼마나 썼는지 펼쳐집니다. CSV 는 &lsquo;사용자 × 앱&rsquo; 교차표로 나갑니다.
        <br />
        <b>실행</b>은 완제품 앱을 끝까지 돌린 횟수(app_runs)이고 <b>토큰</b>은 LLM 호출분입니다 —
        계산만 하는 실행은 토큰이 0이고, 반대로 파싱만 하고 끝내면 실행이 0인데 토큰만 잡힙니다.
      </Note>
    </>
  );
}

function AppTable({ rows, cross, pricing, priced }: {
  rows: AppRow[]; cross: UserAppRow[]; pricing: Pricing; priced: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((prev) => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s });
  return (
    <>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className={TH}>앱</th>
            <th className={TH + " text-right"}>사용자</th>
            <th className={TH + " text-right"}>실행</th>
            <th className={TH + " text-right text-blue-700"}>사용자 토큰</th>
            <th className={TH + " text-right text-violet-700"}>관리자 토큰</th>
            <th className={TH + " text-right"}>총 원가</th>
            <th className={TH + " text-right"}>실행당 토큰</th>
            <th className={TH + " text-right"}>실행당 원가</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((a, i) => {
            const unused = a.runs === 0 && a.calls === 0;
            const key = (a.appId || "a") + i;
            const isOpen = open.has(key);
            const mine = cross
              .filter((x) => (x.appId || "-") === (a.appId || "-"))
              .sort((b, c2) => c2.totalTokens - b.totalTokens || c2.runs - b.runs);
            return (
              <React.Fragment key={key}>
              <tr onClick={() => !unused && toggle(key)} className={"hover:bg-blue-50/50 " + (unused ? "" : "cursor-pointer")}>
                <td className={TD}>
                  <div className="flex items-center gap-1.5">
                    <span className={"text-gray-400 transition-transform " + (isOpen ? "rotate-90" : "") + (unused ? " opacity-0" : "")}>▸</span>
                    <span className={unused ? "text-gray-400" : "font-medium text-gray-900"}>{a.name}</span>
                    {a.status === "published" && (
                      <span className="rounded px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-semibold">발행</span>
                    )}
                    {a.status === "draft" && (
                      <span className="rounded px-1 py-0.5 bg-gray-100 text-gray-500 text-[9px]">임시</span>
                    )}
                  </div>
                </td>
                <td className={NUM}>{n(a.users)}</td>
                <td className={NUM}>{n(a.runs)}</td>
                <td className={NUM + " text-blue-700"}>
                  {a.appTokens > 0 ? (
                    <>{n(a.appTokens)} <span className="text-[10px] text-gray-400">{a.appCalls}회</span></>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className={NUM + " text-violet-700"}>
                  {a.builderTokens > 0 ? (
                    <>{n(a.builderTokens)} <span className="text-[10px] text-gray-400">{a.builderCalls}회</span></>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className={NUM + " font-semibold text-gray-900"}>
                  {priced ? won(wonOf(a.promptTokens, a.outputTokens, pricing)) : <span className="text-gray-300">—</span>}
                </td>
                <td className={NUM}>{n(a.tokensPerRun)}</td>
                <td className={NUM + " font-semibold text-blue-700"}>
                  {priced && a.promptPerRun != null
                    ? won(wonOf(a.promptPerRun, a.outputPerRun || 0, pricing))
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
              {isOpen && (
                <CrossRows rows={mine} label={(x) => x.email || "(알 수 없음)"} pricing={pricing} priced={priced} cols={8} />
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <Note>
        <b>행을 클릭하면</b> 그 앱을 누가 얼마나 썼는지 펼쳐집니다.
        <br />
        <span className="text-blue-700 font-semibold">사용자 토큰</span> = 완제품 앱에서 발생 ·{" "}
        <span className="text-violet-700 font-semibold">관리자 토큰</span> = 빌더에서 만들고 테스트하며 발생.
        옆의 <b>N회</b>는 그 LLM 호출 건수입니다.
        <br />
        <b>실행당</b> 값은 사용자 토큰 ÷ 계측 이후 실행 수 — 요금제 단가의 기준입니다.
        한 번도 실행되지 않은 앱도 <span className="text-gray-400">회색</span>으로 함께 표시합니다.
      </Note>
    </>
  );
}

function MonthTable({ rows, pricing, priced }: { rows: MonthRow[]; pricing: Pricing; priced: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.totalTokens));
  return (
    <>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className={TH}>월</th>
            <th className={TH + " text-right"}>사용자</th>
            <th className={TH + " text-right"}>실행</th>
            <th className={TH + " text-right"}>호출</th>
            <th className={TH + " text-right text-blue-700"}>사용자 토큰</th>
            <th className={TH + " text-right text-violet-700"}>관리자 토큰</th>
            <th className={TH + " text-right"}>원가</th>
            <th className={TH} style={{ width: "30%" }}>추이</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((m) => (
            <tr key={m.month} className="hover:bg-gray-50">
              <td className={TD + " font-medium text-gray-900"}>{m.month}</td>
              <td className={NUM}>{n(m.users)}</td>
              <td className={NUM}>{n(m.runs)}</td>
              <td className={NUM}>{n(m.calls)}</td>
              <td className={NUM + " text-blue-700"}>{m.appTokens > 0 ? n(m.appTokens) : <span className="text-gray-300">—</span>}</td>
              <td className={NUM + " text-violet-700"}>{m.builderTokens > 0 ? n(m.builderTokens) : <span className="text-gray-300">—</span>}</td>
              <td className={NUM + " font-semibold text-gray-900"}>
                {priced ? won(wonOf(m.promptTokens, m.outputTokens, pricing)) : <span className="text-gray-300">—</span>}
              </td>
              <td className={TD}>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden" style={{ width: "100%" }}>
                  <div className="flex h-full" style={{ width: `${(m.totalTokens / max) * 100}%` }}>
                    <div className="bg-blue-500" style={{ width: `${m.totalTokens > 0 ? (m.appTokens / m.totalTokens) * 100 : 0}%` }} />
                    <div className="bg-violet-500 flex-1" />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Note>
        요금제는 월 단위로 정해지므로 월별 흐름이 기준선이 됩니다.
        인사 업무는 <b>시즌성</b>이 강해(승진심의·연말정산 등) 특정 달에 몰립니다 —
        월 상한을 걸면 정작 필요한 달에 막히니 <b>연간 총량</b> 상한이 이 도메인에 맞습니다.
      </Note>
    </>
  );
}

function ModelTable({ rows, pricing, priced }: { rows: ModelRow[]; pricing: Pricing; priced: boolean }) {
  return (
    <>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className={TH}>모델</th>
            <th className={TH + " text-right"}>호출</th>
            <th className={TH + " text-right"}>오류</th>
            <th className={TH + " text-right"}>입력</th>
            <th className={TH + " text-right"}>출력</th>
            <th className={TH + " text-right"}>총 토큰</th>
            <th className={TH + " text-right"}>원가</th>
            <th className={TH + " text-right"}>평균 소요</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((m) => (
            <tr key={m.model} className="hover:bg-gray-50">
              <td className={TD + " font-mono font-medium text-gray-900"}>{m.model}</td>
              <td className={NUM}>{n(m.calls)}</td>
              <td className={NUM + (m.errorCalls > 0 ? " text-rose-600" : " text-gray-300")}>{m.errorCalls || "—"}</td>
              <td className={NUM}>{n(m.promptTokens)}</td>
              <td className={NUM}>{n(m.outputTokens)}</td>
              <td className={NUM}>{n(m.totalTokens)}</td>
              <td className={NUM + " font-semibold text-gray-900"}>
                {priced ? won(wonOf(m.promptTokens, m.outputTokens, pricing)) : <span className="text-gray-300">—</span>}
              </td>
              <td className={NUM + " text-gray-500"}>{m.avgDurationMs ? `${n(m.avgDurationMs)}ms` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Note>
        여기 <b>두 줄 이상</b>이면 환경마다 모델이 갈린 것입니다 —
        <span className="font-mono"> GEMINI_MODEL</span> 환경변수가 빠진 곳이 없는지 확인하세요. 단가가 다르면 원가 계산이 틀어집니다.
      </Note>
    </>
  );
}

function SurfaceTable({ surfaces, ops, pricing, priced }: {
  surfaces: SurfaceRow[]; ops: OpRow[]; pricing: Pricing; priced: boolean;
}) {
  const total = surfaces.reduce((a, s) => a + s.totalTokens, 0);
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200">
        {surfaces.map((s) => (
          <div key={s.surface} className="bg-white p-4">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-bold text-gray-900">{SURFACE_LABEL[s.surface] ?? s.surface}</div>
              <div className="text-[11px] text-gray-400">{total > 0 ? Math.round((s.totalTokens / total) * 100) : 0}%</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {priced ? won(wonOf(s.promptTokens, s.outputTokens, pricing)) : n(s.totalTokens)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              {n(s.totalTokens)} 토큰 · 호출 {n(s.calls)} · 사용자 {n(s.users)}명
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={"h-full " + (s.surface === "app" ? "bg-blue-500" : "bg-violet-500")}
                style={{ width: `${total > 0 ? (s.totalTokens / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <table className="w-full text-xs border-t border-gray-200">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className={TH}>구분</th>
            <th className={TH}>작업</th>
            <th className={TH + " text-right"}>호출</th>
            <th className={TH + " text-right"}>총 토큰</th>
            <th className={TH + " text-right"}>호출당 토큰</th>
            <th className={TH + " text-right"}>호출당 원가</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ops.map((o) => (
            <tr key={o.surface + o.operation} className="hover:bg-gray-50">
              <td className={TD}>
                <span className={"inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold " + (o.surface === "app" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700")}>
                  {SURFACE_LABEL[o.surface] ?? o.surface}
                </span>
              </td>
              <td className={TD + " font-medium text-gray-900"}>{OP_LABEL[o.operation] ?? o.operation}</td>
              <td className={NUM}>{n(o.calls)}</td>
              <td className={NUM}>{n(o.totalTokens)}</td>
              <td className={NUM}>{o.calls > 0 ? n(o.totalTokens / o.calls) : "—"}</td>
              <td className={NUM + " font-semibold text-gray-900"}>
                {priced && o.calls > 0
                  ? won((wonOf(o.promptTokens, o.outputTokens, pricing) || 0) / o.calls)
                  : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Note>
        <b>관리자 빌더</b> 비용은 앱을 만들 때 한 번 드는 <b>구축비</b>이고,
        <b> 사용자 앱</b> 비용만 사용자가 쓸 때마다 반복됩니다.
        구독료에는 뒤엣것만 반영하고, 구축비는 셋업비나 고객획득비용으로 따로 회수하세요.
      </Note>
    </div>
  );
}
