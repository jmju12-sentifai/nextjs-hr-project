"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "../login/actions";

export default function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email?.slice(0, 2) ?? "?").toUpperCase();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative mr-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="계정 메뉴"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-blue-900 ring-1 ring-blue-900 shadow-sm transition duration-200 hover:bg-slate-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_8px_24px_-8px_rgba(30,58,138,0.18)]">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-blue-900 ring-1 ring-blue-900">
              {initial}
            </div>
            <p className="min-w-0 truncate text-xs font-medium text-gray-700">
              {email}
            </p>
          </div>
          <form action={logout} className="border-t border-gray-100">
            <button
              type="submit"
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            >
              <span>로그아웃</span>
              <span aria-hidden className="text-gray-400">→</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
