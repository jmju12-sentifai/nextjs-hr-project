"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Member,
  PaymentRecord,
  ACTION_NAMES,
  formatMemberDate,
  grantPreview,
  memberExpected,
  endOfKoreanDate,
  actionSummary,
  formatMemberTime,
} from "@/lib/members/types";
import {
  AdminNav,
  Badge,
  Pagination,
  PaymentHistory,
  button,
  primary,
  input,
  panel,
} from "../ui";
type Detail = {
  member: Member;
  payments: PaymentRecord[];
  paymentsTotal: number;
  grants: any[];
  note: { note: string } | null;
  actions: any[];
  actionsTotal: number;
  usage: { runs: number; apps: number; last: string | null };
  pending: any;
};
export default function MemberDetail({
  params,
}: {
  params: { userId: string };
}) {
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState(""),
    [duration, setDuration] = useState("1"),
    [endsAt, setEndsAt] = useState(""),
    [reason, setReason] = useState(""),
    [note, setNote] = useState(""),
    [pp, setPp] = useState(1),
    [ap, setAp] = useState(1),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true);
  const request = useRef<{ body: string; id: string } | null>(null);
  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    fetch(
      `/api/admin/members/${params.userId}?paymentsPage=${pp}&actionsPage=${ap}`,
      { signal: c.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
        setNote(d.note?.note || "");
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "회원 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [params.userId, pp, ap, refresh]);
  async function save(kind: string) {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const body = {
        action: kind,
        reason,
        note,
        duration,
        endsAt,
        grantId: data.member.grant_id,
        expected: memberExpected(data.member),
      },
      key = JSON.stringify(body);
    if (request.current?.body !== key)
      request.current = { body: key, id: crypto.randomUUID() };
    try {
      const r = await fetch(`/api/admin/members/${params.userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: request.current.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNotice(`${ACTION_NAMES[kind]} 처리가 완료되었습니다.`);
      setAction("");
      setReason("");
      request.current = null;
      reload();
    } catch (e) {
      setError(
        (e as Error).message || "저장하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  function choose(v: string) {
    setAction(v);
    setReason("");
    setEndsAt("");
    setDuration("1");
    setError("");
    setNotice("");
  }
  const m = data?.member;
  let preview = "",
    previewError = "";
  if (m && action) {
    try {
      if (action === "grant") {
        const g = grantPreview(m, duration, endsAt);
        preview = `무료 이용: ${formatMemberDate(g.startsAt)}부터 ${g.endsAt ? formatMemberDate(g.endsAt) + "까지" : "기한 없이"}. ${g.stopsRenewal ? "자동결제를 중지합니다." : g.nextBillingAt ? "다음 결제일: " + formatMemberDate(g.nextBillingAt) : ""}`;
      } else if (action === "expiry") {
        preview = `이용 종료일: ${formatMemberDate(endOfKoreanDate(endsAt))}. ${m.auto_renew ? "다음 결제일도 함께 변경됩니다." : ""}`;
      } else if (action === "cancel")
        preview = `자동결제를 중지합니다. ${formatMemberDate(m.expires_at)}까지 이용할 수 있습니다.`;
      else if (action === "terminate")
        preview =
          "유료·무료 이용 권한을 지금 종료하고 자동결제를 중지합니다. 결제 취소나 환불은 토스 상점관리자에서 별도로 처리해야 합니다.";
      else if (action === "revoke")
        preview =
          "무료 제공을 회수합니다. 무료 제공으로 미뤄진 유료 이용 기간과 결제일은 원래 일정으로 돌아갑니다. 이미 중지한 자동결제는 다시 시작하지 않습니다.";
    } catch (e) {
      previewError = (e as Error).message;
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <Link href="/admin/members" className="text-sm text-blue-700">
          ← 회원 목록
        </Link>
        {error && (
          <div
            role="alert"
            className="my-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
            <button
              className={button + " ml-3"}
              disabled={busy}
              onClick={reload}
            >
              새로고침
            </button>
          </div>
        )}
        {notice && (
          <p
            role="status"
            className="my-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}
        {!data ? (
          <p className="py-10 text-slate-500">
            {loading
              ? "회원 정보를 불러오는 중입니다."
              : "회원 정보를 확인할 수 없습니다."}
          </p>
        ) : (
          <>
            <div className="my-6 flex flex-wrap items-center gap-3">
              <h1 className="break-all text-2xl font-bold">{m!.email}</h1>
              <Badge state={m!.state} />
              <span className="text-sm text-slate-500">
                가입 {formatMemberDate(m!.created_at)}
              </span>
            </div>
            {data.pending && (
              <p
                role="status"
                className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
              >
                결제 결과를 확인 중입니다. 중복 처리 방지를 위해 권한 변경을
                잠시 제한합니다.
              </p>
            )}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <div className="space-y-6">
                <section className={panel}>
                  <h2 className="mb-5 text-lg font-bold">이용 및 구독 정보</h2>
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-5 text-sm">
                    {[
                      ["이용 권한", m!.active ? "이용 가능" : "이용 종료"],
                      ["구독 플랜", m!.plan || "없음"],
                      ["이용 종료일", formatMemberDate(m!.expires_at)],
                      ["다음 결제일", formatMemberDate(m!.next_billing_at)],
                      ["자동결제", m!.auto_renew ? "사용" : "중지"],
                      [
                        "결제 카드",
                        m!.card_company
                          ? `${m!.card_company} ${m!.card_number_masked || ""}`
                          : "없음",
                      ],
                    ].map(([label, v]) => (
                      <div key={label}>
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="mt-1.5 break-words font-semibold">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {m!.last_renew_error && m!.state === "failed" && (
                    <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                      {m!.last_renew_error}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {[
                      ["grant", "무료 이용 부여"],
                      ["expiry", "종료일 변경"],
                      ["cancel", "정기결제 해지"],
                      ["terminate", "즉시 종료"],
                    ].map(([v, label]) => (
                      <button
                        key={v}
                        className={button}
                        disabled={
                          busy ||
                          loading ||
                          !!data.pending ||
                          (v === "cancel" && !m!.auto_renew) ||
                          (v === "expiry" &&
                            m!.subscription_status !== "active") ||
                          (v === "grant" && !!m!.grant_id) ||
                          (v === "terminate" && !m!.active)
                        }
                        onClick={() => choose(v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {action && (
                    <form
                      className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        save(action);
                      }}
                    >
                      <h3 className="font-bold">{ACTION_NAMES[action]}</h3>
                      {action === "grant" && (
                        <label className="block text-sm">
                          제공 기간
                          <select
                            className={input + " mt-2"}
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                          >
                            <option value="1">1개월</option>
                            <option value="3">3개월</option>
                            <option value="custom">종료일 직접 지정</option>
                            <option value="unlimited">기한 없음</option>
                          </select>
                        </label>
                      )}
                      {(action === "expiry" ||
                        (action === "grant" && duration === "custom")) && (
                        <label className="block text-sm">
                          종료일 (한국 시간, 해당일 23:59까지)
                          <input
                            required
                            type="date"
                            className={input + " mt-2"}
                            value={endsAt}
                            onChange={(e) => setEndsAt(e.target.value)}
                          />
                        </label>
                      )}
                      {preview && (
                        <p className="text-sm leading-6 text-blue-900">
                          {preview}
                        </p>
                      )}
                      {previewError && (
                        <p className="text-sm text-slate-600">{previewError}</p>
                      )}
                      <label className="block text-sm">
                        처리 사유
                        <textarea
                          required
                          maxLength={500}
                          rows={2}
                          className={input + " mt-2"}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="예: 고객사 체험 이용 제공"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          disabled={
                            busy || loading || !!previewError || !reason.trim()
                          }
                          className={primary}
                        >
                          {busy ? "처리 중…" : `${ACTION_NAMES[action]} 확인`}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={button}
                          onClick={() => setAction("")}
                        >
                          취소
                        </button>
                      </div>
                    </form>
                  )}
                </section>
                <section className={panel}>
                  <h2 className="mb-3 text-lg font-bold">무료 제공 내역</h2>
                  {data.grants.length ? (
                    <ul className="divide-y divide-slate-100">
                      {data.grants.map((g) => (
                        <li key={g.id} className="py-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <strong>
                              {formatMemberDate(g.starts_at)} —{" "}
                              {g.ends_at
                                ? formatMemberDate(g.ends_at)
                                : "기한 없음"}
                            </strong>
                            {g.revoked_at ? (
                              <span className="text-slate-500">
                                회수 {formatMemberDate(g.revoked_at)}
                              </span>
                            ) : g.id === m!.grant_id ? (
                              <button
                                disabled={busy || loading || !!data.pending}
                                className={button}
                                onClick={() => {
                                  choose("revoke");
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                  });
                                }}
                              >
                                회수
                              </button>
                            ) : (
                              <span className="text-slate-500">종료</span>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-slate-600">
                            {g.reason}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            처리자 {g.granted_by}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-4 text-sm text-slate-500">
                      무료 제공 내역이 없습니다.
                    </p>
                  )}
                  {data.grants.length >= 20 && (
                    <p className="text-xs text-slate-500">
                      최근 20건입니다. 전체 처리는 아래 처리 기록에서 확인할 수
                      있습니다.
                    </p>
                  )}
                </section>
                <section className={panel}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">결제 이력</h2>
                    <a
                      href="https://app.tosspayments.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-700"
                    >
                      토스 상점관리자 ↗
                    </a>
                  </div>
                  <PaymentHistory payments={data.payments} />
                  <Pagination
                    page={pp}
                    total={data.paymentsTotal}
                    onChange={setPp}
                  />
                  {data.payments.some((p) => p.kind === "legacy") && (
                    <p className="mt-3 text-xs text-slate-500">
                      기존 결제는 이력 관리 시작 전 남아 있던 마지막 결제입니다.
                      정확한 승인일은 토스에서 확인해 주세요.
                    </p>
                  )}
                </section>
              </div>
              <aside className="space-y-6">
                <section className={panel}>
                  <h2 className="text-lg font-bold">이번 달 이용</h2>
                  <div className="my-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">리포트 생성</p>
                      <strong className="mt-2 block text-2xl">
                        {data.usage.runs}회
                      </strong>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">사용한 앱</p>
                      <strong className="mt-2 block text-2xl">
                        {data.usage.apps}개
                      </strong>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    최근 이용 {formatMemberDate(m!.last_run_at)}
                  </p>
                </section>
                <form
                  className={panel}
                  onSubmit={(e) => {
                    e.preventDefault();
                    save("note");
                  }}
                >
                  <h2 className="mb-3 text-lg font-bold">운영 메모</h2>
                  <textarea
                    aria-label="운영 메모"
                    className={input}
                    rows={5}
                    maxLength={5000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="관리자만 볼 수 있는 메모"
                  />
                  <button
                    disabled={
                      busy || loading || note === (data.note?.note || "")
                    }
                    className={button + " mt-3"}
                  >
                    메모 저장
                  </button>
                </form>
              </aside>
            </div>
            <section className={panel + " mt-6"}>
              <h2 className="mb-3 text-lg font-bold">처리 기록</h2>
              {data.actions.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.actions.map((a) => (
                    <li key={a.id} className="py-4 text-sm">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <strong>{ACTION_NAMES[a.action] || a.action}</strong>
                        <span className="text-slate-500">
                          {formatMemberTime(a.created_at)} · {a.actor_email}
                        </span>
                      </div>
                      {a.detail.reason && (
                        <p className="mt-2 whitespace-pre-wrap break-words">
                          {a.detail.reason}
                        </p>
                      )}
                      {a.action !== "note" && actionSummary(a.detail) && (
                        <p className="mt-2 text-xs text-slate-500">
                          {actionSummary(a.detail)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-sm text-slate-500">
                  처리 기록이 없습니다.
                </p>
              )}
              <Pagination
                page={ap}
                total={data.actionsTotal}
                onChange={setAp}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
