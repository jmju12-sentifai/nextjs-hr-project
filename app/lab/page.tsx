import SectionShell, { PlannedList } from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "K Prime Lab — HRcoach" };

export default async function LabPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="K PRIME LAB"
      title="인사 전 영역을 앱으로."
      lead="인사 컨설팅의 복잡한 블랙박스를 걷어내고, 누구나 실행 가능한 도구로 바꾸는 것이 목표입니다."
    >
      <PlannedList
        items={[
          { title: "비전 및 미션", desc: "AI 기반 HR 혁신에 대한 조직 비전 소개" },
          { title: "R&D 로드맵", desc: "확장 계획 및 기술 타임라인 공개" },
        ]}
      />
    </SectionShell>
  );
}
