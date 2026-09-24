import Link from "next/link";
import SectionShell from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";
import FlowDiagram from "./FlowDiagram";

export const metadata = {
  title: "AI인사솔루션 안내 — HRcoach",
  description: "기준 문서를 올리면 검토부터 산출물까지 이어지는 인사 업무 자동화.",
};

/**
 * 엑셀 1번 — HRcoach·AI인사앱 소개 / 시각화 튜토리얼 / 활용 노하우.
 *
 * ⚠️ 아래 카피와 사례는 현재 서비스 동작을 근거로 쓴 초안이다.
 *    확정 원고를 받으면 이 파일의 문구만 교체하면 된다.
 */

const WHY = [
  {
    t: "판단 근거가 남습니다",
    d: "결과 숫자만 주지 않습니다. 어떤 기준의 어느 조항에 어떻게 걸렸는지가 산출물에 함께 담깁니다. 결재선에서 되묻는 질문이 줄어듭니다.",
  },
  {
    t: "회사 기준을 그대로 씁니다",
    d: "일반론이 아니라 올려주신 사규·기준표를 지식으로 만들어 판단합니다. 회사마다 다른 직급 체계나 체류연한도 그대로 반영됩니다.",
  },
  {
    t: "같은 골격, 다른 업무",
    d: "모든 앱이 4단계 흐름을 공유합니다. 한 앱을 써보면 나머지 앱의 사용법도 같아서 담당자 교육 비용이 들지 않습니다.",
  },
  {
    t: "구축이 필요 없습니다",
    d: "설치도 연동도 없습니다. 브라우저에서 파일을 올리는 것으로 시작하고, 필요한 앱만 골라 씁니다.",
  },
];

const PLAYBOOK = [
  {
    tag: "채용 시즌",
    t: "지원자 100명 서류 검토를 하루로",
    d: "모집요강과 이력서를 올려 직무적합도 리포트를 일괄로 뽑고, 경력직은 경력·직급 산정 앱으로 입사 조건까지 한 번에 정리합니다.",
    apps: "입사지원서 기초데이터 파싱 · 직무적합도 ATS 레포트 · 경력·직급·직위 산정",
  },
  {
    tag: "평가·승진 시즌",
    t: "승진 심의 대상 판정의 기준을 통일",
    d: "체류연한·평가등급·면접 결과를 회사 기준에 대조해 대상 여부와 근거를 함께 냅니다. 심의 자료를 사람마다 다르게 만들 일이 없어집니다.",
    apps: "승진심의 대상 판정 · 조직별 평가결과 현황표",
  },
  {
    tag: "상시 보상·복리",
    t: "매달 반복되는 산정 업무를 앱으로",
    d: "퇴직금·연차보상금·임금피크제처럼 기준은 고정인데 대상자만 바뀌는 업무를, 자료만 갈아 끼워 반복 처리합니다.",
    apps: "퇴직금 예상금액 · 연차보상금 · 임금피크제 · 경조사 지원금",
  },
];

export default async function SolutionPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="AI HR SOLUTION"
      title="기준을 올리면, 판단과 문서가 따라옵니다."
      lead="HRcoach는 인사 실무를 대신 판단해 주는 도구가 아니라, 회사의 기준대로 판단하고 그 근거를 문서로 남기는 도구입니다."
    >
      <section className="mb-16">
        <h2 className="mb-5 text-[20px] font-bold tracking-[-0.035em] text-[var(--sec-heading)]">
          왜 HRcoach 인가
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {WHY.map((w) => (
            <div
              key={w.t}
              className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6"
            >
              <h3 className="text-[15px] font-bold text-[var(--sec-heading)]">{w.t}</h3>
              <p className="mt-2.5 break-keep text-[13px] leading-[1.85] text-[var(--sec-muted)]">
                {w.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="tutorial" className="mb-16 scroll-mt-28">
        <h2 className="mb-1.5 text-[20px] font-bold tracking-[-0.035em] text-[var(--sec-heading)]">
          시각화 튜토리얼
        </h2>
        <p className="mb-6 text-[13px] text-[var(--sec-muted)]">
          모든 앱이 같은 4단계로 동작합니다. 무엇을 올리면 무엇이 나오는지 흐름으로 보세요.
        </p>
        <FlowDiagram />
      </section>

      <section id="playbook" className="mb-14 scroll-mt-28">
        <h2 className="mb-1.5 text-[20px] font-bold tracking-[-0.035em] text-[var(--sec-heading)]">
          활용 노하우
        </h2>
        <p className="mb-6 text-[13px] text-[var(--sec-muted)]">
          시즌별로 어떤 앱을 묶어 쓰면 좋은지 정리했습니다.
        </p>
        <div className="space-y-4">
          {PLAYBOOK.map((p) => (
            <article
              key={p.t}
              className="rounded-[var(--card-radius)] border border-[var(--card-line)] bg-[var(--card-bg)] p-6"
            >
              <span className="inline-block rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10.5px] font-black text-[var(--accent)]">
                {p.tag}
              </span>
              <h3 className="mt-3.5 break-keep text-[16px] font-bold text-[var(--sec-heading)]">
                {p.t}
              </h3>
              <p className="mt-2 break-keep text-[13px] leading-[1.85] text-[var(--sec-muted)]">
                {p.d}
              </p>
              <p className="mt-4 border-t border-[var(--sec-line)] pt-3.5 text-[12px] text-[var(--sec-heading)]">
                <span className="mr-2 font-bold text-[var(--accent)]">쓰는 앱</span>
                {p.apps}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/solution/methodology"
          className="rounded-xl border border-[var(--card-line)] bg-[var(--card-bg)] px-6 py-3.5 text-[13px] font-bold text-[var(--sec-heading)] transition hover:border-[var(--accent)]"
        >
          AX 방법론 읽기
        </Link>
        <Link
          href="/apps"
          className="rounded-xl bg-[var(--accent)] px-6 py-3.5 text-[13px] font-bold text-[var(--accent-on)] transition hover:opacity-90"
        >
          앱 둘러보기 →
        </Link>
        <Link
          href="/requests"
          className="rounded-xl border border-[var(--card-line)] bg-[var(--card-bg)] px-6 py-3.5 text-[13px] font-bold text-[var(--sec-heading)] transition hover:border-[var(--accent)]"
        >
          필요한 앱 요청하기
        </Link>
      </div>
    </SectionShell>
  );
}
