"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { AppSchema } from "app-renderer";

type AppRow = {
  id: string;
  name: string;
  status: string;
  version: number;
  published_at: string | null;
  created_at: string;
  app_schema: AppSchema;
};

export default function BuilderTempPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppRow | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setErr("");
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("apps")
        .select("id, name, status, version, published_at, created_at, app_schema")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setApps((data || []) as AppRow[]);
    } catch (e: any) {
      setErr(e.message || "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = apps.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const counts = {
    all: apps.length,
    published: apps.filter((a) => a.status === "published").length,
    draft: apps.filter((a) => a.status === "draft").length,
  };

  const deleteApp = async (row: AppRow) => {
    setConfirmDelete(null);
    setDeletingId(row.id);
    try {
      const sb = getSupabase();
      // DB 의 ON DELETE CASCADE 가 app_runs 도 자동 정리해 줌.
      // (RLS 정책에 막혀 클라이언트가 app_runs 를 직접 못 지우는 케이스 회피)
      const { error } = await sb.from("apps").delete().eq("id", row.id);
      if (error) throw error;
      setApps((list) => list.filter((a) => a.id !== row.id));
    } catch (e: any) {
      alert("삭제 실패: " + (e.message || e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 pt-10 pb-14 px-6">
      <div className="mx-auto max-w-5xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-blue-700 font-mono mb-1.5">
              관리자 · 앱 관리
            </div>
            <h1 className="text-2xl font-bold text-gray-900">앱 리스트</h1>
            <p className="mt-1 text-sm text-gray-500">
              저장·발행된 모든 앱을 한 곳에서 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchList}
              disabled={loading}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ↻ 새로고침
            </button>
            <Link
              href="/admin/builder"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition"
            >
              + 새 앱 추가
            </Link>
          </div>
        </div>

        {/* 필터 탭 + 카운트 */}
        <div className="mb-4 flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 p-1 w-fit shadow-sm">
          {(
            [
              { k: "all", label: "전체", n: counts.all },
              { k: "published", label: "발행", n: counts.published },
              { k: "draft", label: "임시저장", n: counts.draft },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={
                "px-3 py-1.5 text-xs rounded-md transition " +
                (filter === t.k
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-gray-600 hover:bg-gray-100")
              }
            >
              {t.label}{" "}
              <span
                className={
                  "ml-1 inline-flex items-center justify-center min-w-[18px] px-1 rounded-full text-[10px] " +
                  (filter === t.k
                    ? "bg-white/25 text-white"
                    : "bg-gray-200 text-gray-600")
                }
              >
                {t.n}
              </span>
            </button>
          ))}
        </div>

        {/* 본문 */}
        {loading && (
          <div className="rounded-xl border border-gray-100 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
            불러오는 중…
          </div>
        )}
        {err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            에러: {err}
          </div>
        )}
        {!loading && !err && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="text-sm text-gray-500 mb-4">
              {filter === "all"
                ? "아직 생성된 앱이 없습니다."
                : filter === "published"
                ? "발행된 앱이 없습니다."
                : "임시저장된 앱이 없습니다."}
            </div>
            <Link
              href="/admin/builder"
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + 첫 앱 만들기
            </Link>
          </div>
        )}

        {!loading && !err && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((row) => {
              const label = row.app_schema?.meta?.appName || row.name || "(이름 없음)";
              const tagline = row.app_schema?.meta?.tagline || "";
              const isPub = row.status === "published";
              return (
                <div
                  key={row.id}
                  className="group rounded-xl border border-slate-200 bg-white shadow-md hover:shadow-lg hover:border-blue-200 transition overflow-hidden ring-1 ring-slate-100"
                >
                  {/* 메타 (앱 ID + 발행일) — 상단 */}
                  <div className="px-5 py-2 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 text-[10px] font-mono text-gray-600 flex items-center justify-between gap-3 flex-wrap border-b border-blue-100">
                    <span className="break-all text-gray-700">{row.id}</span>
                    <span className="shrink-0 text-gray-500">
                      {row.published_at
                        ? `발행 ${row.published_at.slice(0, 10)}`
                        : `생성 ${row.created_at.slice(0, 10)}`}
                    </span>
                  </div>

                  {/* 헤더 */}
                  <div className="px-5 pt-4 pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={
                          "shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full ring-1 " +
                          (isPub
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-gray-100 text-gray-600 ring-gray-200")
                        }
                      >
                        {isPub ? "발행" : "임시저장"}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        v{row.version}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-gray-900 leading-snug truncate">
                      {label}
                    </h3>
                    {tagline && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {tagline}
                      </p>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">
                    <Link
                      href={`/admin/builder?appId=${row.id}`}
                      className="flex-1 text-center rounded-md bg-white border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 transition"
                    >
                      편집
                    </Link>
                    {isPub && (
                      <Link
                        href={`/apps/${row.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center rounded-md bg-white border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-emerald-300 hover:text-emerald-700 transition"
                      >
                        미리보기 ↗
                      </Link>
                    )}
                    <button
                      onClick={() => setConfirmDelete(row)}
                      disabled={deletingId === row.id}
                      className="rounded-md bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-rose-300 hover:text-rose-700 transition disabled:opacity-50"
                    >
                      {deletingId === row.id ? "삭제 중…" : "🗑 삭제"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 푸터 도움말 */}
        <div className="mt-8 text-center text-[11px] text-gray-400">
          <span>발행된 앱은 홈 "인사AI 앱 세트"에 자동으로 노출됩니다.</span>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">앱 삭제</h3>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900 break-keep">
                  "{confirmDelete.app_schema?.meta?.appName || confirmDelete.name || "(이름 없음)"}"
                </span>
                <br />
                앱을 영구 삭제하시겠습니까?
              </p>
              <div className="mt-4 rounded-lg bg-rose-50 border-l-4 border-rose-400 px-3 py-2.5 text-left">
                <p className="text-xs text-rose-800 leading-relaxed">
                  ⚠ 해당 앱의 <b>실행 기록(app_runs)</b>도 함께 삭제됩니다.
                  <br />
                  되돌릴 수 없습니다.
                </p>
              </div>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-100"
              >
                취소
              </button>
              <button
                onClick={() => deleteApp(confirmDelete)}
                className="flex-1 py-3.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
