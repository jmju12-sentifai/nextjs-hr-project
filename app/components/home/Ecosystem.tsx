import Image from "next/image";
import Link from "next/link";

/**
 * 상생 구조 설명 — woohouse 9/10 「솔루션 소개5」 를 설명 섹션으로 단순화했다.
 * 원본의 수익 구조·인증 문구는 아직 운영하지 않는 내용이라 뺐고,
 * 지향하는 방향이라는 점을 본문에 밝혀 둔다.
 */
const ROLES = [
  {
    img: "/home/eco-senior.webp",
    alt: "시니어 인사 전문가",
    role: "시니어 · 경단녀",
    lead: "쌓아온 인사 경험을 다시 일로",
    points: ["실무 노하우 전달", "전문 경력 연장"],
  },
  {
    img: "/home/eco-junior.webp",
    alt: "인사 직무를 준비하는 주니어",
    role: "취준생 · 주니어",
    lead: "실제 인사 업무로 쌓는 경험",
    points: ["실무형 인사 경험", "경력형 신입으로 성장"],
  },
  {
    img: "/home/eco-sme.webp",
    alt: "중소기업 인사 담당자",
    role: "중소기업",
    lead: "인사팀이 작아도 기준대로",
    points: ["AI 업무 자동화", "인사 제도 안정"],
  },
];

/** 카드 사이 화살표에 붙는 흐름 설명 */
const LINKS = ["경험과 노하우 전달", "훈련된 인재가 성장 지원"];

const GROWTH = ["사람의 성장", "기업의 성장", "사회의 성장"];

export default function Ecosystem() {
  return (
    <section className="border-y border-[var(--sec-line)] bg-[var(--sec-bg-alt)]">
      <div className="site-wrap py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[var(--accent)]">
              WIN-WIN ECOSYSTEM
            </p>
            <h2 className="text-[28px] font-bold tracking-[-0.045em] text-[var(--sec-heading)]">
              함께 만드는 더 나은 일의 미래
            </h2>
            <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-[var(--sec-muted)]">
              사람의 경험이 기술과 만나 개인과 기업이 함께 성장하도록, HRcoach가 만들어가고 있는
              선순환 구조입니다.
            </p>
          </div>
          <Link
            href="/lab"
            className="text-[12px] font-bold text-[var(--sec-muted)] transition hover:text-[var(--accent)]"
          >
            비전 및 로드맵 →
          </Link>
        </div>

        <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {ROLES.map((r, i) => (
            <div key={r.role} className="contents">
              {i > 0 && <FlowLink label={LINKS[i - 1]} />}
              <article className="flex gap-4 rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-5">
                <Image
                  src={r.img}
                  alt={r.alt}
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-full bg-[var(--sec-bg-alt)] object-cover"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.06em] text-[var(--accent)]">
                    {r.role}
                  </p>
                  <p className="mt-1 text-[15px] font-bold leading-snug tracking-[-0.03em] text-[var(--sec-heading)]">
                    {r.lead}
                  </p>
                  <ul className="mt-2.5 space-y-1">
                    {r.points.map((p) => (
                      <li key={p} className="flex items-center gap-1.5 text-[12.5px] text-[var(--sec-fg)]">
                        <span aria-hidden className="text-[var(--accent)]">
                          ✓
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>
          ))}
        </div>

        {/* 순환의 마지막 고리 — 기업 활용이 다시 사람에게 기회로 돌아간다 */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-[var(--card-radius)] border border-dashed border-[var(--card-line)] px-5 py-4">
          <p className="flex items-center gap-2.5 text-[13px] text-[var(--sec-fg)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-[var(--accent)]"
              aria-hidden
            >
              <path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2" />
              <path d="M18.5 2.5v3.3h-3.3M5.5 21.5v-3.3h3.3" />
            </svg>
            기업의 활용이 새로운 기회와 교육 수요를 만들고, 다시 사람의 성장으로 이어집니다.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {GROWTH.map((g) => (
              <li
                key={g}
                className="rounded-[var(--chip-radius)] bg-[var(--card-bg)] px-3 py-1 text-[11.5px] font-bold text-[var(--sec-heading)] ring-1 ring-[var(--card-line)]"
              >
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FlowLink({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 lg:w-[92px] lg:flex-col lg:py-0">
      <span className="text-center text-[11px] font-bold leading-tight text-[var(--accent)] lg:max-w-[84px]">
        {label}
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 rotate-90 text-[var(--accent)] lg:rotate-0"
        aria-hidden
      >
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </div>
  );
}
