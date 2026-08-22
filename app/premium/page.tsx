import SectionShell, { PlannedList } from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "프리미엄앱 — HRcoach" };

export default async function PremiumPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="PREMIUM APPS"
      title="제휴·연동이 필요한 고단가 앱."
      lead="연 30만 원 SME 구독과 별도로, 건별 결제 및 크레딧으로 운영되는 앱입니다."
    >
      <PlannedList
        items={[
          { title: "제휴 파트너사 특화 앱", desc: "심리검사 플랫폼, 전문 노무법인 연계 고단가 앱 (별도 과금·크레딧)" },
          { title: "엔터프라이즈 맞춤형 앱", desc: "기존 ERP·인사 시스템 API 연동형 심화 앱 (B2B 영업 연계)" },
        ]}
      />
    </SectionShell>
  );
}
