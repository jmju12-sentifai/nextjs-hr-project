"use client";

import Image from "next/image";
import Link from "next/link";
import { type SearchItem } from "@/lib/catalog";
import { HERO_VARIANTS, SITE_VARIANT, useHeroTheme, type HeroVariant } from "./HeroTheme";
import QuickSearch from "./QuickSearch";
import SiteHeader from "./SiteHeader";

const FEATURES = [
  { img: "/hero/feat-shield-check.png", title: "안전한 데이터 관리", desc: "보안 인증 기반" },
  { img: "/hero/feat-cloud.png", title: "즉시 적용 가능", desc: "설치 없이 바로" },
  { img: "/hero/feat-bolt.png", title: "업무 자동화", desc: "반복 업무 절감" },
  { img: "/hero/feat-chart.png", title: "데이터 기반 판단", desc: "일관된 의사결정" },
];

type Props = {
  userEmail: string | null;
  isAdmin: boolean;
  searchItems: SearchItem[];
};

/** 시안 전환 토글은 비교용이라 /draft 에서만 띄운다. 운영 홈에는 나오면 안 된다. */
type HeroProps = Props & { showSwitcher?: boolean };

export default function Hero({ userEmail, isAdmin, searchItems, showSwitcher = false }: HeroProps) {
  const { variant: picked, setVariant } = useHeroTheme();

  // 시안 선택은 /draft 전용이다. 운영 홈은 확정 시안으로 고정한다.
  // 이걸 고정하지 않으면 예전에 /draft 에서 다른 시안을 눌러본 방문자의
  // localStorage 값이 그대로 운영 홈의 히어로로 나온다.
  const variant = showSwitcher ? picked : SITE_VARIANT;

  return (
    <>
      {showSwitcher && <VariantSwitcher current={picked} onChange={setVariant} />}
      {variant === "a" && (
        <HeroA userEmail={userEmail} isAdmin={isAdmin} searchItems={searchItems} />
      )}
      {variant === "b" && (
        <HeroB userEmail={userEmail} isAdmin={isAdmin} searchItems={searchItems} />
      )}
      {variant === "c" && (
        <HeroC userEmail={userEmail} isAdmin={isAdmin} searchItems={searchItems} />
      )}
    </>
  );
}

/* ── 시안 전환 ─────────────────────────────────────────── */

function VariantSwitcher({
  current,
  onChange,
}: {
  current: HeroVariant;
  onChange: (v: HeroVariant) => void;
}) {
  return (
    <div className="sticky top-0 z-[90] border-b border-[var(--sec-line)] bg-[var(--sec-bg-alt)]/90 backdrop-blur-lg">
      <div className="site-wrap flex items-center gap-3 py-2">
        <span className="mr-auto hidden text-[10px] font-black tracking-[0.18em] text-[var(--sec-muted)] sm:block">
          HERO 시안
        </span>
        <div className="flex gap-1.5 overflow-x-auto">
          {HERO_VARIANTS.map((v) => {
            const on = v.key === current;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onChange(v.key)}
                aria-pressed={on}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
                    : "border-[var(--card-line)] bg-[var(--card-bg)] text-[var(--sec-heading)] hover:border-[var(--accent)]"
                }`}
              >
                <span className={on ? "opacity-60" : "text-[var(--accent)]"}>{v.no}</span>
                {v.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 공통 조각 ─────────────────────────────────────────── */

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

function Kicker({ children, tone = "blue" }: { children: string; tone?: "blue" | "white" | "sky" }) {
  const color =
    tone === "white" ? "text-white" : tone === "sky" ? "text-[#8fdfff]" : "text-brand-blue";
  return (
    <p
      className={`hero-kicker mb-[17px] flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.2em] ${color}`}
    >
      {children}
    </p>
  );
}

function FeatureItem({ f }: { f: (typeof FEATURES)[number] }) {
  return (
    <article className="feat">
      <span className="feat-ico">
        <Image src={f.img} alt="" width={40} height={40} />
      </span>
      <span>
        <b>{f.title}</b>
        <small>{f.desc}</small>
      </span>
    </article>
  );
}

/* ── 01 Object Stage ───────────────────────────────────── */

function HeroA({ userEmail, isAdmin, searchItems }: Props) {
  return (
    <section className="hero-a">
      <div className="hero-wrap relative z-20">
        <div className="theme-light mt-4 rounded-[15px] bg-white px-6 shadow-[0_22px_48px_-35px_rgba(0,7,41,0.72)]">
          <SiteHeader userEmail={userEmail} isAdmin={isAdmin} />
        </div>
      </div>
      <div className="hero-wrap a-body">
        <div className="a-copy text-white">
          <Kicker tone="white">AI-Powered HR App Store</Kicker>
          <h1 className="hero-title text-[clamp(56px,5.6vw,84px)] font-bold">
            인사 업무의 모든 것,
            <em className="block not-italic text-[#8adfff]">하나의 흐름으로.</em>
          </h1>
          <p className="hero-desc !text-white/70">
            채용부터 퇴직까지 필요한 기준과 자료를 올리면, 검토부터 산출물까지 HRcoach가 하나의
            흐름으로 완성합니다.
          </p>
          <div className="mt-7 flex gap-2.5">
            <Link href="/signup" className="hero-btn hero-btn-primary">
              무료로 시작하기 <span>→</span>
            </Link>
            <Link href="/apps" className="hero-btn hero-btn-dark">
              앱 둘러보기
            </Link>
          </div>
        </div>
        <div className="a-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/premium-object.png" alt="투명 아크릴 안의 HR 문서 오브젝트" />
        </div>
      </div>
      <QuickSearch items={searchItems} className="a-search" label="QUICK SEARCH" />
    </section>
  );
}

/* ── 02 Connected Hub ──────────────────────────────────── */

function HeroB({ userEmail, isAdmin, searchItems }: Props) {
  return (
    <section className="hero-b">
      <div className="hero-wrap">
        <SiteHeader userEmail={userEmail} isAdmin={isAdmin} bordered />
      </div>
      <div className="hero-wrap b-body">
        <div className="b-copy relative z-[4]">
          <Kicker>One HR App Store</Kicker>
          <h1 className="hero-title text-[clamp(55px,5.2vw,80px)] font-bold text-brand-ink">
            필요한 HR을,
            <em className="block not-italic text-brand-blue">한곳에서 연결하다.</em>
          </h1>
          <p className="hero-desc">
            채용·평가·보상·교육·인력운영까지 흩어진 인사 업무를 하나의 앱스토어에서 찾고 바로
            시작하세요.
          </p>
          <QuickSearch items={searchItems} className="mt-6 max-w-[535px]" />
          <div className="b-features">
            {FEATURES.map((f) => (
              <FeatureItem key={f.title} f={f} />
            ))}
          </div>
        </div>
        <div className="b-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/ring-hub.png" alt="채용·평가·보상·교육·인력운영을 연결하는 HR 허브" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ring-logo" src="/hero/wordmark.svg" alt="HRcoach" />
        </div>
      </div>
    </section>
  );
}

/* ── 03 App Layers (기본값) ────────────────────────────── */

function HeroC({ userEmail, isAdmin, searchItems }: Props) {
  return (
    <section className="hero-c">
      <div className="hero-wrap">
        <SiteHeader userEmail={userEmail} isAdmin={isAdmin} bordered />
      </div>
      <div className="hero-wrap c-body">
        <div className="c-copy relative z-[5]">
          <Kicker>HR Work, Ready to Use</Kicker>
          <h1 className="hero-title text-[clamp(55px,5.15vw,79px)] font-bold text-brand-ink">
            인사 업무를,
            <em className="block not-italic text-brand-blue">한 장씩 꺼내 쓰다.</em>
          </h1>
          <p className="hero-desc">
            복잡한 구축 없이 필요한 앱만 선택하세요. 기준 검토부터 결과 문서까지 각 업무가 완성된
            도구로 준비되어 있습니다.
          </p>
          <QuickSearch items={searchItems} className="mt-6 max-w-[540px]" label="FIND YOUR APP" />
        </div>
        <div className="c-visual">
          <div className="stack-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero/layer-stack.png"
              alt="채용·평가·보상·교육·인력운영 업무 레이어"
              className="h-full w-full object-contain"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="stack-logo" src="/hero/wordmark.svg" alt="HRcoach" />
            <div className="c-float">
              {FEATURES.map((f) => (
                <FeatureItem key={f.title} f={f} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* 모바일 폴백 — 떠 있는 카드 대신 2×2 */}
      <div className="hero-wrap">
        <div className="c-features">
          {FEATURES.map((f) => (
            <FeatureItem key={f.title} f={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
