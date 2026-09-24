import Image from "next/image";
import Link from "next/link";
import { SITE_NAV } from "@/lib/catalog";

const COMPANY = [
  ["상호명", "케이프라임연구소"],
  ["대표자명", "조윤정"],
  ["사업자등록번호", "264-24-02200"],
  // 토스페이먼츠 심사 의견 — 사업자등록증의 도로명 주소와 표기를 맞춘다(구 주소: 명일동 225-4).
  ["사업자 주소", "서울특별시 강동구 상암로63길 14"],
  ["고객센터", "010.9041.9930"],
  ["이메일 문의", "besthrcoach@naver.com"],
  ["통신판매업 신고번호", "2026-서울강동-0856"],
  ["개인정보관리책임자", "조윤정"],
];

/**
 * 히어로 시안(<html data-hero>)에 따라 색이 함께 바뀐다.
 * 1안에서는 페이지 전체가 딥 네이비라 푸터도 같은 바탕 위에 얹힌다.
 */
export default function Footer() {
  return (
    <footer className="border-t border-[var(--sec-line)] bg-[var(--sec-bg-alt)] text-[var(--sec-fg)]">
      <div className="site-wrap py-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <Image
              src="/hero/wordmark.svg"
              alt="HRcoach"
              width={132}
              height={33}
              className="wordmark-dark"
            />
            <Image
              src="/hero/wordmark-white.svg"
              alt="HRcoach"
              width={132}
              height={33}
              className="wordmark-light"
            />
            <p className="mt-5 max-w-[460px] break-keep text-[13.5px] leading-[1.85] text-[var(--sec-muted)]">
              우리는 인사 컨설팅의 복잡한 블랙박스를 걷어내고, 누구나 실행 가능한 도구로 바꿉니다.
              기업의 성장은 데이터와 로직 위에 세워져야 한다는 믿음으로 서비스를 만듭니다.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3.5 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
            >
              무료로 시작하기
              <span aria-hidden>→</span>
            </Link>
          </div>

          <nav aria-label="푸터 메뉴" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
            {SITE_NAV.map((item) => (
              <div key={item.label}>
                <Link
                  href={item.href}
                  className="text-[12.5px] font-bold text-[var(--sec-heading)] transition hover:text-[var(--accent)]"
                >
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="mt-3 space-y-2">
                    {item.children.map((c) => (
                      <li key={c.label}>
                        <Link
                          href={c.href}
                          className="text-[12px] text-[var(--sec-muted)] transition hover:text-[var(--accent)]"
                        >
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </div>

        <dl className="mt-12 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-[var(--sec-line)] pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {COMPANY.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11.5px] leading-relaxed">
              <dt className="shrink-0 font-bold text-[var(--sec-heading)] opacity-70">{k}</dt>
              <dd className="min-w-0 break-words text-[var(--sec-muted)]">{v}</dd>
            </div>
          ))}
          <div className="flex gap-2 text-[11.5px] leading-relaxed">
            <dt className="shrink-0 font-bold text-[var(--sec-heading)] opacity-70">호스팅제공자</dt>
            <dd className="text-[var(--sec-muted)]">자체구축</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--sec-line)] pt-6 text-[11px] text-[var(--sec-muted)] md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} AI인사팀 (K Prime HR Solution). All Rights Reserved.</p>
          <div className="flex flex-wrap gap-x-7 gap-y-2 font-bold">
            <Link href="/legal/privacy" className="transition hover:text-[var(--accent)]">
              개인정보처리방침
            </Link>
            <Link href="/legal/refund" className="transition hover:text-[var(--accent)]">
              환불정책
            </Link>
            <Link href="/legal/support" className="transition hover:text-[var(--accent)]">
              고객센터
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
