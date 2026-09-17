import Link from "next/link";
import SiteHeader from "./SiteHeader";

/**
 * GNB 대메뉴 페이지의 공통 껍데기.
 * 메인의 GNB 를 실제 링크로 바꾸면서 생긴 목적지들을 받아준다.
 */
export default function SectionShell({
  eyebrow,
  title,
  lead,
  children,
  userEmail = null,
  isAdmin = false,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
  userEmail?: string | null;
  isAdmin?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[var(--sec-bg)]">
      <div className="site-wrap">
        <SiteHeader userEmail={userEmail} isAdmin={isAdmin} bordered />
      </div>

      <section className="site-wrap py-16">
        <p className="mb-3 text-[11px] font-black tracking-[0.18em] text-[var(--accent)]">{eyebrow}</p>
        <h1 className="max-w-[720px] break-keep text-[38px] font-bold leading-[1.08] tracking-[-0.055em] text-[var(--sec-heading)] sm:text-[52px]">
          {title}
        </h1>
        {lead && (
          <p className="mt-5 max-w-[620px] text-[14.5px] leading-[1.8] text-[var(--sec-muted)]">{lead}</p>
        )}
        <div className="mt-12">{children}</div>
      </section>
    </div>
  );
}

/** 엑셀 3-depth 하위 메뉴를 그대로 보여주는 준비중 목록 */
export function PlannedList({
  items,
}: {
  items: { title: string; desc: string; id?: string }[];
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div
            key={it.title}
            id={it.id}
            className="scroll-mt-28 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--sec-bg-alt)] p-6"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="rounded-full bg-[var(--sec-line)] px-2 py-0.5 text-[10px] font-black text-[var(--sec-muted)]">
                준비 중
              </span>
            </div>
            <h2 className="text-[15px] font-bold text-[var(--sec-heading)]">{it.title}</h2>
            <p className="mt-2 break-keep text-[12.5px] leading-relaxed text-[var(--sec-muted)]">
              {it.desc}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-[13px] text-[var(--sec-muted)]">
        먼저 필요한 기능이 있다면{" "}
        <Link href="/requests" className="font-bold text-[var(--accent)] underline">
          앱개발요청
        </Link>
        에 남겨주세요. 우선순위에 반영합니다.
      </p>
    </>
  );
}
