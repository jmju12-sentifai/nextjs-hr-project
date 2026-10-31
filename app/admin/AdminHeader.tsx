"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, adminNavActive } from "@/lib/admin-navigation";
import UserMenu from "@/app/components/UserMenu";

export default function AdminHeader({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/admin/applist"
            className="flex shrink-0 items-center gap-3"
            aria-label="HRcoach 관리자 홈"
          >
            <span className="text-xl font-extrabold tracking-tight text-blue-700">
              HRcoach
            </span>
            <span className="border-l border-slate-200 pl-3 text-sm font-medium text-slate-500">
              관리자
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              href="/"
              className="whitespace-nowrap text-sm font-medium text-slate-600 hover:text-blue-700"
            >
              사이트 보기 ↗
            </Link>
            <UserMenu email={email} isAdmin />
          </div>
        </div>
        <nav
          aria-label="관리자 메뉴"
          className="flex flex-wrap gap-x-1 gap-y-0 sm:gap-x-4"
        >
          {ADMIN_NAV.map(({ label, href }) => {
            const active = adminNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap border-b-2 px-2 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${active ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
