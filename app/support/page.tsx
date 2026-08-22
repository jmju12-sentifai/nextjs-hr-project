import SectionShell, { PlannedList } from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "문의 및 요청 — HRcoach" };

export default async function SupportPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="SUPPORT"
      title="문의 및 요청."
      lead="필요한 앱을 요청하거나, 쓰다 막힌 부분·오류·제휴 건을 남겨주세요."
    >
      <PlannedList
        items={[
          { title: "고객 지원 센터", desc: "챗봇 기반 실시간 FAQ 및 1:1 문의" },
          { id: "voc", title: "VOC 및 에러 리포트", desc: "UI 버그, 모델 환각(Hallucination) 등 불만·오류 접수" },
          { id: "partnership", title: "B2B 제휴 제안", desc: "비즈니스 파트너십 및 프리미엄 앱 입점 문의" },
        ]}
      />
      <div className="mt-8 rounded-2xl border border-brand-line bg-white p-6">
        <p className="text-[13px] font-bold text-brand-ink">지금 바로 연락하려면</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-brand-muted">
          고객센터 010.9041.9930 · 이메일 besthrcoach@naver.com
        </p>
      </div>
    </SectionShell>
  );
}
