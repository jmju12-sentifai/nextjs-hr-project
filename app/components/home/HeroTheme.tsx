"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type HeroVariant = "a" | "b" | "c";

export const HERO_VARIANTS: { key: HeroVariant; no: string; name: string }[] = [
  { key: "a", no: "01", name: "Object Stage" },
  { key: "b", no: "02", name: "Connected Hub" },
  { key: "c", no: "03", name: "App Layers" },
];

const DEFAULT_VARIANT: HeroVariant = "b";
const STORAGE_KEY = "hrcoach.hero";

function isVariant(v: unknown): v is HeroVariant {
  return v === "a" || v === "b" || v === "c";
}

type Ctx = { variant: HeroVariant; setVariant: (v: HeroVariant) => void };
const HeroThemeContext = createContext<Ctx>({
  variant: DEFAULT_VARIANT,
  setVariant: () => {},
});

export function useHeroTheme() {
  return useContext(HeroThemeContext);
}

/**
 * 히어로 시안 선택을 페이지 전체가 공유한다.
 * <html data-hero="a|b|c"> 를 세워두면 globals.css 의 토큰 세트가 바뀌고,
 * 그 아래 섹션·푸터가 서버 컴포넌트인 채로 히어로에 맞춰 따라온다.
 */
export default function HeroTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scoped = pathname?.startsWith("/draft") ?? false;
  const [variant, setVariantState] = useState<HeroVariant>(DEFAULT_VARIANT);

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("hero");
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const pick = (fromQuery || stored || "").toLowerCase();
    if (isVariant(pick)) setVariantState(pick);
  }, []);

  // 시안 테마는 /draft 안에서만 씌운다.
  // 전역으로 두면 시안 1안을 한 번 본 사용자의 운영 페이지까지 네이비로 물든다.
  useEffect(() => {
    if (scoped) document.documentElement.dataset.hero = variant;
    else delete document.documentElement.dataset.hero;
  }, [variant, scoped]);

  const setVariant = useCallback((v: HeroVariant) => {
    setVariantState(v);
    window.localStorage.setItem(STORAGE_KEY, v);
  }, []);

  return (
    <HeroThemeContext.Provider value={{ variant, setVariant }}>
      {children}
    </HeroThemeContext.Provider>
  );
}
