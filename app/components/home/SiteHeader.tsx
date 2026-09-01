"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SITE_NAV, type NavItem } from "@/lib/catalog";
import UserMenu from "../UserMenu";

type Props = {
  userEmail: string | null;
  isAdmin: boolean;
  /** 1안처럼 흰 카드 위에 얹히는 경우와 일반 페이지의 테두리 처리를 구분한다 */
  bordered?: boolean;
};

/**
 * 사이트 공통 헤더. 대메뉴 4개(+드롭다운) / 우측 계정 영역 / 모바일 드로어.
 * 히어로 3안과 하위 페이지가 같은 헤더를 쓰도록 한곳에 모았다.
 */
export default function SiteHeader({ userEmail, isAdmin, bordered = false }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 바깥 클릭 / Esc 로 닫는다
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // 마우스가 대메뉴↔드롭다운 사이 틈을 지날 때 깜빡이지 않도록 살짝 늦춰 닫는다
  const hoverOpen = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };

  return (
    <div
      className={`relative z-30 flex h-[84px] items-center gap-7 ${
        bordered ? "border-b border-[var(--sec-line)]" : ""
      }`}
    >
      <Link href="/" className="mr-auto shrink-0" aria-label="HRcoach 홈">
        <Image src="/hero/wordmark.svg" alt="HRcoach" width={132} height={33} priority />
      </Link>

      <nav ref={navRef} aria-label="주요 메뉴" className="hidden lg:block">
        <ul className="flex list-none items-center gap-[clamp(18px,2vw,34px)]">
          {SITE_NAV.map((item) => (
            <NavEntry
              key={item.label}
              item={item}
              open={openMenu === item.label}
              onHoverOpen={() => hoverOpen(item.label)}
              onHoverClose={hoverClose}
              onToggle={() =>
                setOpenMenu((cur) => (cur === item.label ? null : item.label))
              }
            />
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3.5">
        {userEmail ? (
          <>
            {/* 관리자 진입은 헤더에 그대로 노출한다.
                프로필 드롭다운 안으로 넣었더니 헤더에서 사라진 것처럼 보였다. */}
            {isAdmin && (
              <Link
                href="/admin/applist"
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--accent)] px-4 py-3 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90 sm:inline-flex"
              >
                <span aria-hidden>+</span> 앱 만들러 가기
              </Link>
            )}
            <UserMenu email={userEmail} isAdmin={isAdmin} />
          </>
        ) : (
          <>
            {/* 로그인과 CTA 는 같은 형태의 버튼 쌍으로 두고 채도로만 위계를 준다.
                텍스트 링크로 두면 옆의 채워진 버튼에 눌려 로그인 경로가 안 보인다. */}
            <Link
              href="/login"
              className="hidden whitespace-nowrap rounded-[10px] bg-[var(--accent-soft)] px-5 py-3 text-[13px] font-bold text-[var(--accent)] transition hover:opacity-80 sm:block"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-2 whitespace-nowrap rounded-[10px] bg-[var(--accent)] px-5 py-3 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
            >
              무료로 시작하기
              <Arrow />
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--card-line)] text-[var(--sec-heading)] lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
            {mobileOpen ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-[84px] z-40 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-4 shadow-[var(--card-shadow)] lg:hidden">
          {SITE_NAV.map((item) => (
            <div key={item.label} className="border-b border-[var(--sec-line)] py-3 last:border-b-0">
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block text-[14px] font-bold text-[var(--sec-heading)]"
              >
                {item.label}
              </Link>
              {item.children && (
                <ul className="mt-2 space-y-1.5 pl-3">
                  {item.children.map((c) => (
                    <li key={c.label}>
                      <Link
                        href={c.href}
                        onClick={() => setMobileOpen(false)}
                        className="block text-[12.5px] text-[var(--sec-muted)]"
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {isAdmin && (
            <Link
              href="/admin/applist"
              onClick={() => setMobileOpen(false)}
              className="mt-4 block rounded-[10px] bg-[var(--accent)] px-5 py-3 text-center text-[13px] font-bold text-[var(--accent-on)]"
            >
              + 앱 만들러 가기
            </Link>
          )}
          {!userEmail && (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="mt-4 block rounded-[10px] bg-[var(--accent-soft)] px-5 py-3 text-center text-[13px] font-bold text-[var(--accent)]"
            >
              로그인
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function NavEntry({
  item,
  open,
  onHoverOpen,
  onHoverClose,
  onToggle,
}: {
  item: NavItem;
  open: boolean;
  onHoverOpen: () => void;
  onHoverClose: () => void;
  onToggle: () => void;
}) {
  if (!item.children) {
    return (
      <li>
        <Link
          href={item.href}
          className="whitespace-nowrap text-[13px] font-bold text-[var(--sec-heading)] transition hover:text-[var(--accent)]"
        >
          {item.label}
        </Link>
      </li>
    );
  }

  return (
    <li className="relative" onMouseEnter={onHoverOpen} onMouseLeave={onHoverClose}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-1 whitespace-nowrap text-[13px] font-bold transition ${
          open ? "text-[var(--accent)]" : "text-[var(--sec-heading)] hover:text-[var(--accent)]"
        }`}
      >
        {item.label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-1/2 top-[calc(100%+14px)] w-[330px] -translate-x-1/2 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-2 shadow-[var(--card-shadow)]">
          {/* 버튼과 패널 사이 틈을 덮어 hover 가 끊기지 않게 한다 */}
          <span className="absolute -top-4 left-0 h-4 w-full" aria-hidden />
          <ul>
            {item.children.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className="block rounded-xl px-3.5 py-2.5 transition hover:bg-[var(--accent-soft)]"
                >
                  <span className="block text-[13px] font-bold text-[var(--sec-heading)]">{c.label}</span>
                  {c.desc && (
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--sec-muted)]">
                      {c.desc}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
