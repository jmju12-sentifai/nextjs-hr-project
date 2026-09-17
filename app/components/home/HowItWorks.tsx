import Image from "next/image";
import Link from "next/link";
import { Nanum_Pen_Script } from "next/font/google";

const hand = Nanum_Pen_Script({ weight: "400", subsets: ["latin"], preload: false });

/**
 * 5단계 사용 흐름 — woohouse 9/10 「솔루션 소개4」 이미지를 사이트 톤으로 단순화한 섹션.
 * 단계 문구는 실제 앱 실행 순서(앱 선택 → 규정 → 대상자 → 대조 → 리포트)를 따른다.
 */
const STEPS = [
  { title: "업무 앱 선택", desc: "로그인 후 필요한 인사 업무 앱을 고릅니다." },
  { title: "인사 규정 업로드", format: "PDF", desc: "우리 회사 규정·기준표를 올립니다." },
  { title: "대상자 정보 업로드", format: "Excel", desc: "분석할 대상자 명단이나 이력서를 올립니다." },
  { title: "AI 비교·분석", desc: "규정과 대상자 정보를 대조해 판단합니다." },
  { title: "리포트 다운로드", desc: "근거가 담긴 결과 문서를 바로 현업에 씁니다." },
];

/** 오른쪽 앱 화면 그림 — 실제 앱 실행기의 단계 이름과 맞춘다. 누르는 요소가 아니라 예시 이미지다. */
const PROGRESS = [
  { label: "인사 규정 파일 확인", state: "완료" },
  { label: "대상자 정보 파일 확인", state: "완료" },
  { label: "규정 대조·판단", state: "98%" },
  { label: "결과 리포트 생성", state: "대기" },
];

export default function HowItWorks() {
  return (
    <section className="site-wrap py-20">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[var(--accent)]">
            HOW IT WORKS
          </p>
          <h2 className="text-[28px] font-bold tracking-[-0.045em] text-[var(--sec-heading)]">
            단 5단계의 쉬운 업무 자동화
          </h2>
          <p className="mt-2 text-[14px] text-[var(--sec-muted)]">
            복잡한 설정 없이, 처음인 분도 그대로 따라 할 수 있습니다.
          </p>
        </div>
        <Link
          href="/apps"
          className="text-[12px] font-bold text-[var(--sec-muted)] transition hover:text-[var(--accent)]"
        >
          앱 둘러보기 →
        </Link>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="relative rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-5"
          >
            {i > 0 && (
              <span
                aria-hidden
                className="absolute -left-[11px] top-8 hidden h-2 w-2 rotate-45 border-r-2 border-t-2 border-[var(--sec-line)] lg:block"
              />
            )}
            <span className="text-[28px] font-bold leading-none tracking-[-0.04em] text-[var(--accent)]">
              {i + 1}
            </span>
            <p className="mt-3.5 text-[14px] font-bold leading-snug text-[var(--sec-heading)]">
              {s.title}
              {s.format && (
                <span className="ml-1.5 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 align-middle text-[10.5px] font-bold text-[var(--accent)]">
                  {s.format}
                </span>
              )}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--sec-muted)]">{s.desc}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid overflow-hidden rounded-[var(--band-radius)] border border-[var(--card-line)] bg-[var(--sec-bg-alt)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative min-h-[260px] md:min-h-[320px]">
          <p
            className={`${hand.className} absolute left-7 top-6 z-[1] -rotate-6 text-[25px] leading-[1.05] text-[var(--accent)]`}
          >
            처음이어도
            <br />
            이렇게 쉬울 수 있어요!
          </p>
          <Image
            src="/home/flow-person.webp"
            alt="노트북 앞에서 웃고 있는 인사담당자"
            width={900}
            height={672}
            className="absolute bottom-0 left-1/2 w-[82%] max-w-[440px] -translate-x-1/2 md:left-[-3%] md:w-[100%] md:max-w-none md:translate-x-0"
          />
        </div>

        <div className="relative z-[1] p-4 sm:p-7 md:pl-0">
          <AppScreen />
        </div>
      </div>
    </section>
  );
}

/** 앱 실행 화면을 그림처럼 보여주는 예시. 버튼·메뉴는 동작하지 않도록 통째로 장식 처리한다. */
function AppScreen() {
  return (
    <div
      role="img"
      aria-label="HRcoach 앱에서 AI 분석이 진행되고 리포트 미리보기가 나오는 화면 예시"
      className="pointer-events-none relative select-none"
    >
      <div
        aria-hidden
        className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]"
      >
        {/* 상단 바 */}
        <div className="flex items-center gap-3 border-b border-[var(--card-line)] px-4 py-2.5">
          <span className="text-[13px] font-bold tracking-[-0.04em] text-[var(--sec-heading)]">
            HR<span className="text-[var(--accent)]">coach</span>
          </span>
          <span className="ml-3 hidden h-6 flex-1 items-center rounded-full bg-[var(--sec-bg-alt)] px-3 text-[10px] text-[var(--sec-muted)] sm:flex">
            무엇을 도와드릴까요?
          </span>
          <span className="ml-auto h-5 w-5 rounded-full bg-[var(--accent-soft)]" />
        </div>

        <div className="grid grid-cols-[92px_1fr] sm:grid-cols-[104px_1fr]">
          {/* 사이드 메뉴 */}
          <ul className="grid content-start gap-1 border-r border-[var(--card-line)] p-2.5 text-[10.5px] text-[var(--sec-muted)]">
            {["대시보드", "인사검토", "조직관리", "리포트", "설정"].map((m, i) => (
              <li
                key={m}
                className={`rounded-md px-2 py-1.5 ${
                  i === 1 ? "bg-[var(--accent-soft)] font-bold text-[var(--accent)]" : ""
                }`}
              >
                {m}
              </li>
            ))}
          </ul>

          <div className="grid gap-3 p-3.5 sm:grid-cols-[1.15fr_1fr]">
            {/* 진행 패널 */}
            <div className="rounded-lg border border-[var(--card-line)] p-3.5">
              <p className="text-[13px] font-bold tracking-[-0.03em] text-[var(--sec-heading)]">
                AI 분석이 진행 중입니다.
              </p>
              <p className="mt-0.5 text-[9.5px] text-[var(--sec-muted)]">승진심의 대상 판정</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--accent-soft)]">
                  <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-[var(--accent)] to-sky-300" />
                </div>
                <span className="text-[12px] font-bold tabular-nums text-[var(--accent)]">98%</span>
              </div>
              <ul className="mt-3 grid gap-1.5">
                {PROGRESS.map((p) => {
                  const done = p.state !== "대기";
                  return (
                    <li key={p.label} className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[7px] font-black ${
                          done
                            ? "bg-[var(--accent)] text-white"
                            : "border border-[var(--sec-line)] bg-[var(--card-bg)]"
                        }`}
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span className={done ? "text-[var(--sec-fg)]" : "text-[var(--sec-muted)]"}>
                        {p.label}
                      </span>
                      <span className="ml-auto tabular-nums text-[var(--sec-muted)]">{p.state}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 리포트 미리보기 */}
            <div className="rounded-lg border border-[var(--card-line)] p-3">
              <p className="text-[10.5px] font-bold text-[var(--sec-heading)]">분석 리포트 미리보기</p>
              <div className="mt-2 rounded-md border border-[var(--card-line)] bg-[var(--sec-bg-alt)] p-2.5">
                <div className="rounded bg-[var(--card-bg)] p-2.5 shadow-[0_10px_20px_-16px_rgba(7,26,59,0.5)]">
                  <p className="text-[8px] font-bold text-[var(--accent)]">HRcoach</p>
                  <p className="mt-1 text-[10.5px] font-bold leading-tight text-[var(--sec-heading)]">
                    승진심의 대상 판정 리포트
                  </p>
                  <div className="mt-2 grid gap-1">
                    <span className="h-1 w-full rounded bg-[var(--sec-line)]" />
                    <span className="h-1 w-4/5 rounded bg-[var(--sec-line)]" />
                  </div>
                  <svg viewBox="0 0 100 34" className="mt-2 h-8 w-full" aria-hidden>
                    <path d="M0 30 C18 26 26 12 44 16 S72 4 100 8 V34 H0Z" fill="var(--accent-soft)" />
                    <path d="M0 30 C18 26 26 12 44 16 S72 4 100 8" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
                  </svg>
                </div>
              </div>
              <div className="mt-2.5 rounded-md bg-[var(--accent)] py-1.5 text-center text-[10px] font-bold text-white">
                ↓ 리포트 다운로드
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 떠 있는 안내 카드 */}
      <div
        aria-hidden
        className="absolute -bottom-3 right-3 hidden items-center gap-2 rounded-xl bg-[var(--card-bg)] px-3 py-2 text-[11px] font-bold text-[var(--sec-heading)] shadow-[var(--card-shadow)] ring-1 ring-[var(--card-line)] sm:flex"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] text-white">
          ✓
        </span>
        복잡한 인사 업무도 HRcoach와 함께라면 쉽습니다
      </div>
    </div>
  );
}
