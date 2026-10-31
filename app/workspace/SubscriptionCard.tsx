"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Member, PaymentRecord, formatMemberDate } from "@/lib/members/types";
import {
  Badge,
  Pagination,
  PaymentHistory,
  button,
  primary,
  panel,
} from "@/app/admin/members/ui";
export default function SubscriptionCard() {
  const [data, setData] = useState<{
      member: Member;
      payments: PaymentRecord[];
      total: number;
      pending: boolean;
    } | null>(null),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    fetch(`/api/subscription/status?page=${page}`, { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [page, retry]);
  useEffect(() => {
    if (!data?.pending) return;
    const id = setInterval(() => setRetry((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, [data?.pending]);
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/subscription/cancel", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message);
      setConfirm(false);
      setRetry((n) => n + 1);
    } catch (e) {
      setError((e as Error).message || "해지하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="billing" className={panel + " mb-8 text-slate-900"}>
      <h2 className="mb-4 text-lg font-bold">이용 및 결제 내역</h2>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <button
            className={button + " ml-3"}
            onClick={() => setRetry((n) => n + 1)}
          >
            다시 시도
          </button>
        </p>
      )}
      {!data ? (
        loading && (
          <p className="text-sm text-slate-500">
            구독 정보를 불러오는 중입니다.
          </p>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge state={data.member.state} />
              <p className="mt-3 text-sm text-slate-600">
                {data.member.state === "free"
                  ? `무료 이용 ${data.member.grant_ends_at ? formatMemberDate(data.member.grant_ends_at) + "까지" : "기한 없음"}`
                  : data.member.active
                    ? `이용 종료일 ${formatMemberDate(data.member.expires_at)}`
                    : "유료 구독 또는 무료 제공 기간에 앱을 이용할 수 있습니다."}
              </p>
              {data.member.next_billing_at && (
                <p className="mt-1 text-sm text-slate-600">
                  다음 결제일 {formatMemberDate(data.member.next_billing_at)}
                </p>
              )}
              {data.member.grant_id && data.member.state !== "free" && (
                <p className="mt-1 text-sm text-slate-600">
                  무료 제공 예정:{" "}
                  {formatMemberDate(data.member.grant_starts_at)}부터{" "}
                  {formatMemberDate(data.member.grant_ends_at)}까지
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {data.member.auto_renew && (
                <button
                  disabled={busy || loading || data.pending}
                  className={button}
                  onClick={() => setConfirm(true)}
                >
                  정기결제 해지
                </button>
              )}
              {(!data.member.active || data.member.state === "free") &&
                !data.pending && (
                  <Link href="/payment" className={primary}>
                    유료 구독 시작
                  </Link>
                )}
            </div>
          </div>
          {data.member.state === "free" && (
            <p className="mt-3 text-sm text-slate-500">
              결제하면 남은 무료 제공이 종료되고 유료 구독이 바로 시작됩니다.
            </p>
          )}
          {data.pending && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
            >
              결제 결과를 확인 중입니다. 완료되면 이용 상태가 자동으로
              갱신됩니다.
            </p>
          )}
          {confirm && (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-sm">
                자동결제를 중지해도 {formatMemberDate(data.member.expires_at)}
                까지 이용할 수 있습니다.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy || loading}
                  className={primary}
                  onClick={cancel}
                >
                  {busy ? "처리 중…" : "해지 확인"}
                </button>
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => setConfirm(false)}
                >
                  돌아가기
                </button>
              </div>
            </div>
          )}
          <h3 className="mb-2 mt-7 font-semibold">결제 이력</h3>
          <PaymentHistory payments={data.payments} />
          <Pagination page={page} total={data.total} onChange={setPage} />
        </>
      )}
    </section>
  );
}
