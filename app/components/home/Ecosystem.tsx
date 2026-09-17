import Image from "next/image";
import Link from "next/link";

/**
 * 상생 구조 설명 — woohouse 9/10 「솔루션 소개5」 의 삼각 순환 구조를 설명 섹션 톤으로 옮겼다.
 * 원본의 수익 구조·인증 문구는 아직 운영하지 않는 내용이라 뺐고,
 * 지향하는 방향이라는 점을 본문에 밝혀 둔다.
 */
const ROLES = [
  {
    key: "senior",
    img: "/home/eco-senior.webp",
    alt: "시니어 인사 전문가",
    role: "시니어 · 경단녀",
    points: ["실무 노하우 전달", "전문 경력 연장"],
    // 삼각형 꼭짓점 위치 (컨테이너 대비 %)
    pos: "left-1/2 top-[3%] -translate-x-1/2",
  },
  {
    key: "junior",
    img: "/home/eco-junior.webp",
    alt: "인사 직무를 준비하는 주니어",
    role: "취준생 · 주니어",
    points: ["실무형 인사 경험", "경력형 신입으로 성장"],
    pos: "left-[3%] top-[52%]",
  },
  {
    key: "sme",
    img: "/home/eco-sme.webp",
    alt: "중소기업 인사 담당자",
    role: "중소기업",
    points: ["AI 업무 자동화", "인사 제도 안정"],
    pos: "right-[3%] top-[52%]",
  },
];

/** 순환 화살표 옆 설명 — 시니어 → 주니어 → 중소기업 → 다시 사람에게 */
const FLOWS = [
  { text: "경험과 노하우를\n전달", pos: "left-[6%] top-[25%] text-right" },
  { text: "훈련된 인재가\n기업 성장을 지원", pos: "left-1/2 bottom-[1%] -translate-x-1/2 text-center" },
  { text: "기업의 활용이\n새로운 기회로", pos: "right-[6%] top-[25%] text-left" },
];

const GROWTH = [
  { title: "사람의 성장", desc: "더 많은 기회의 나눔" },
  { title: "기업의 성장", desc: "지속 가능한 경쟁력" },
  { title: "사회의 성장", desc: "모두에게 좋은 일의 미래" },
];

export default function Ecosystem() {
  return (
    <section className="border-y border-[var(--sec-line)] bg-[var(--sec-bg-alt)]">
      <div className="site-wrap py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
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

        <div className="grid items-center gap-6 lg:grid-cols-[1.55fr_1fr]">
          {/* 삼각 순환 구조 — 넓은 화면 */}
          <div className="relative mx-auto hidden aspect-[1.3/1] w-full max-w-[680px] md:block">
            <svg viewBox="0 0 130 100" className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <marker id="eco-arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="3.2" markerHeight="3.2" orient="auto">
                  <path d="M0 0 6 3 0 6z" fill="var(--accent)" />
                </marker>
              </defs>
              {/* 시니어 → 주니어 */}
              <path d="M52 20 Q30 30 25 50" fill="none" stroke="var(--accent)" strokeWidth=".45" strokeDasharray="1.4 1.2" markerEnd="url(#eco-arrow)" opacity=".75" />
              {/* 주니어 → 중소기업 */}
              <path d="M40 86 Q65 96 90 86" fill="none" stroke="var(--accent)" strokeWidth=".45" strokeDasharray="1.4 1.2" markerEnd="url(#eco-arrow)" opacity=".75" />
              {/* 중소기업 → 시니어 */}
              <path d="M105 50 Q100 30 78 20" fill="none" stroke="var(--accent)" strokeWidth=".45" strokeDasharray="1.4 1.2" markerEnd="url(#eco-arrow)" opacity=".75" />
            </svg>

            {/* 가운데 HRcoach */}
            <div className="absolute left-1/2 top-[50%] flex aspect-square w-[21%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[var(--card-bg)] shadow-[var(--card-shadow)] ring-1 ring-[var(--card-line)]">
              <span className="text-[17px] font-bold tracking-[-0.05em] text-[var(--sec-heading)]">
                HR<span className="text-[var(--accent)]">coach</span>
              </span>
              <span className="mt-0.5 text-[8.5px] tracking-[0.16em] text-[var(--sec-muted)]">
                PEOPLE CONNECT
              </span>
            </div>

            {ROLES.map((r) => (
              <RoleNode key={r.key} role={r} className={`absolute w-[31%] ${r.pos}`} />
            ))}

            {FLOWS.map((f) => (
              <p
                key={f.text}
                className={`absolute whitespace-pre-line text-[11.5px] font-bold leading-snug text-[var(--accent)] ${f.pos}`}
              >
                {f.text}
              </p>
            ))}
          </div>

          {/* 좁은 화면 — 세로로 잇는다 */}
          <div className="grid gap-3 md:hidden">
            {ROLES.map((r, i) => (
              <div key={r.key} className="grid gap-3">
                <RoleNode role={r} />
                <p className="text-center text-[11.5px] font-bold text-[var(--accent)]">
                  ↓ {FLOWS[i].text.replace("\n", " ")}
                </p>
              </div>
            ))}
          </div>

          {/* 성장 요약 */}
          <div className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6">
            <ul className="grid gap-4">
              {GROWTH.map((g) => (
                <li key={g.title} className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <GrowthIcon kind={g.title} />
                  </span>
                  <span>
                    <b className="block text-[14.5px] text-[var(--sec-heading)]">{g.title}</b>
                    <span className="text-[12.5px] text-[var(--sec-muted)]">{g.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-[var(--sec-line)] pt-5 text-[14px] font-bold leading-relaxed tracking-[-0.02em] text-[var(--sec-heading)]">
              “사람이 성장하면 기업이 성장하고,
              <br />
              그것이 더 나은 사회를 만듭니다.”
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleNode({ role, className = "" }: { role: (typeof ROLES)[number]; className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        <Image
          src={role.img}
          alt={role.alt}
          width={96}
          height={96}
          className="h-[76px] w-[76px] rounded-full border-4 border-[var(--card-bg)] bg-[var(--accent-soft)] object-cover shadow-[0_18px_36px_-22px_rgba(7,26,59,0.6)] lg:h-[92px] lg:w-[92px]"
        />
      </div>
      <div className="relative -mt-3 w-full rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] px-3.5 pb-3 pt-5">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--sec-heading)] px-3 py-0.5 text-[11.5px] font-bold text-[var(--sec-bg)]">
          {role.role}
        </span>
        <ul className="space-y-1">
          {role.points.map((p) => (
            <li key={p} className="flex items-center gap-1.5 text-[12px] text-[var(--sec-fg)]">
              <span aria-hidden className="text-[var(--accent)]">
                ✓
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GrowthIcon({ kind }: { kind: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };
  if (kind === "사람의 성장")
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 14.2A4.5 4.5 0 0 1 21 18" />
      </svg>
    );
  if (kind === "기업의 성장")
    return (
      <svg {...common}>
        <rect x="5" y="3" width="10" height="18" rx="1" />
        <path d="M15 9h4v12h-4M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15ZM5 19l7-7" />
    </svg>
  );
}
