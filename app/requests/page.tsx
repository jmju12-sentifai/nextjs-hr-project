import SectionShell, { PlannedList } from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "앱개발요청 — HRcoach" };

export default async function RequestsPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="REQUEST A NEW APP"
      title="필요한 인사 앱을 직접 요청하세요."
      lead="대상 기능·목적·산출물을 남기면 검토 후 개발 우선순위에 반영합니다."
    >
      <PlannedList
        items={[
          { title: "신규 개발 요청 폼", desc: "대상 기능·목적·산출물을 입력하는 요청 폼 (PSST 논리 구조)" },
          { title: "진행 상태 트래킹", desc: "요청 접수 → 검토 → 개발 중 → 완료 상태 표시" },
          { title: "유저 투표소", desc: "타 유저 아이디어 공유 및 투표를 통한 우선순위 결정" },
        ]}
      />
    </SectionShell>
  );
}
