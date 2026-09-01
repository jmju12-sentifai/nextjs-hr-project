import SectionShell from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";
import FaqSearch from "./FaqSearch";
import InquiryForm from "./InquiryForm";

export const metadata = { title: "문의 및 요청 — HRcoach" };

/** 엑셀 7번 — 고객 지원 센터 · VOC 및 에러 리포트 · B2B 제휴 제안 */
export default async function SupportPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="SUPPORT"
      title="문의 및 요청."
      lead="자주 묻는 질문에서 먼저 찾아보시고, 없으면 아래로 남겨주세요."
    >
      <section className="mb-14">
        <h2 className="mb-4 text-[18px] font-bold tracking-[-0.03em] text-[var(--sec-heading)]">
          자주 묻는 질문
        </h2>
        <FaqSearch />
      </section>

      <section id="voc" className="scroll-mt-28">
        <h2 className="mb-1.5 text-[18px] font-bold tracking-[-0.03em] text-[var(--sec-heading)]">
          문의 남기기
        </h2>
        <p className="mb-5 text-[13px] text-[var(--sec-muted)]">
          유형을 고르면 필요한 항목만 표시됩니다.
        </p>
        <span id="partnership" className="block scroll-mt-28" />
        <InquiryForm defaultEmail={viewer.email} />
      </section>
    </SectionShell>
  );
}
