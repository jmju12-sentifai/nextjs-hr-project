"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Member, MEMBER_STATES, formatMemberDate } from "@/lib/members/types";
import { AdminNav, Badge, Pagination, button, input, panel } from "./ui";
export default function Members() {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [state, setState] = useState(""),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0),
    [data, setData] = useState<{
      members: Member[];
      total: number;
      counts: Record<string, number>;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/admin/members?${new URLSearchParams({ q: search, state, page: String(page) })}`,
      { signal: c.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "회원 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [search, state, page, retry]);
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">회원·구독 관리</h1>
            <p className="mt-2 text-sm text-slate-500">
              회원의 이용 권한과 결제 내역을 관리합니다.
            </p>
          </div>
          <a
            href="https://app.tosspayments.com"
            target="_blank"
            rel="noopener noreferrer"
            className={button}
          >
            토스 상점관리자 ↗
          </a>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          {[["", "전체"], ...Object.entries(MEMBER_STATES)].map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setState(key);
                  setPage(1);
                }}
                aria-pressed={state === key}
                className={`${panel} text-left ${state === key ? "ring-2 ring-blue-600" : ""}`}
              >
                <span className="text-sm text-slate-500">{label}</span>
                <strong className="mt-2 block text-2xl">
                  {data?.counts[key || "all"]?.toLocaleString() ?? "—"}
                </strong>
              </button>
            ),
          )}
        </div>
        <section className={panel}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
              setPage(1);
            }}
            className="mb-5 flex max-w-lg gap-2"
          >
            <input
              aria-label="회원 이메일 검색"
              className={input}
              placeholder="회원 이메일 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={200}
            />
            <button className={button}>검색</button>
          </form>
          {error ? (
            <div
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
              <button
                onClick={() => setRetry((n) => n + 1)}
                className={button + " ml-3"}
              >
                다시 시도
              </button>
            </div>
          ) : loading ? (
            <p role="status" className="py-12 text-center text-slate-500">
              회원 목록을 불러오는 중입니다.
            </p>
          ) : !data?.members.length ? (
            <p className="py-12 text-center text-slate-500">
              조건에 맞는 회원이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    {[
                      "회원",
                      "가입일",
                      "이용 상태",
                      "다음 결제일 / 종료일",
                      "결제 카드",
                      "최근 이용",
                    ].map((t) => (
                      <th
                        key={t}
                        className="whitespace-nowrap py-3 pr-5 font-medium"
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-5 pr-5">
                        <Link
                          className="font-semibold text-blue-700 hover:underline"
                          href={`/admin/members/${m.id}`}
                        >
                          {m.email || "이메일 없음"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap pr-5">
                        {formatMemberDate(m.created_at)}
                      </td>
                      <td className="pr-5">
                        <Badge state={m.state} />
                      </td>
                      <td className="whitespace-nowrap pr-5">
                        {m.state === "free" && !m.grant_ends_at
                          ? "기한 없음"
                          : formatMemberDate(
                              m.state === "free"
                                ? m.grant_ends_at
                                : m.next_billing_at || m.expires_at,
                            )}
                      </td>
                      <td className="whitespace-nowrap pr-5 text-slate-500">
                        {m.card_company
                          ? `${m.card_company} ${m.card_number_masked || ""}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatMemberDate(m.last_run_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && data && (
            <Pagination
              page={page}
              total={data.total}
              size={25}
              onChange={setPage}
            />
          )}
        </section>
      </div>
    </main>
  );
}
