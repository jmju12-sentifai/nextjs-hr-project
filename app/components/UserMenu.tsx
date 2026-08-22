"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "../login/actions";
import { PROFILE_NAV } from "@/lib/catalog";

/**
 * 로그인 사용자의 프로필 메뉴.
 * 엑셀 "4. 내 작업실" 과 "5. 결제 내역 및 영수증" 은 로그인 후에만 의미가 있어
 * 대메뉴가 아니라 여기로 들어온다.
 */
export default function UserMenu({
  email,
  isAdmin = false,
}: {
  email: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email?.slice(0, 2) ?? "?").toUpperCase();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="내 작업실 및 계정 메뉴"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[12px] font-black text-brand-blue ring-1 ring-[#c9dcfb] transition hover:bg-[#e2edff] focus:outline-none focus:ring-2 focus:ring-brand-blue"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[264px] overflow-hidden rounded-2xl border border-brand-line bg-white shadow-[0_30px_60px_-28px_rgba(7,28,68,0.45)]">
          <div className="flex items-center gap-3 border-b border-[#eef2f8] px-4 py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[12px] font-black text-brand-blue ring-1 ring-[#c9dcfb]">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-bold text-brand-ink">
                {email}
              </span>
              <span className="mt-0.5 block text-[10.5px] text-brand-muted">
                {isAdmin ? "관리자 계정" : "구독 계정"}
              </span>
            </span>
          </div>

          <div className="px-2 py-2">
            {PROFILE_NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-2 transition hover:bg-[#f2f7ff]"
              >
                <span className="block text-[13px] font-bold text-brand-ink">{n.label}</span>
                {n.desc && (
                  <span className="mt-0.5 block text-[10.5px] leading-snug text-brand-muted">
                    {n.desc}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {isAdmin && (
            <div className="border-t border-[#eef2f8] px-2 py-2">
              <Link
                href="/admin/applist"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-2 text-[12.5px] font-bold text-brand-blue transition hover:bg-[#f2f7ff]"
              >
                + 앱 만들러 가기
              </Link>
            </div>
          )}

          <form action={logout} className="border-t border-[#eef2f8]">
            <button
              type="submit"
              className="flex w-full items-center justify-between px-4 py-3 text-[12.5px] font-medium text-brand-muted transition hover:bg-[#f7fafd] hover:text-brand-ink"
            >
              <span>로그아웃</span>
              <span aria-hidden>→</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
