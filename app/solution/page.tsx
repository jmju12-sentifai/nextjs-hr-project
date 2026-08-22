import SectionShell, { PlannedList } from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "AI인사솔루션 안내 — HRcoach" };

export default async function SolutionPage() {
  const viewer = await getViewer();
  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="AI HR SOLUTION"
      title="AI가 인사 업무를 어떻게 바꾸는가."
      lead="HRcoach는 기준 문서를 지식으로 만들고, 개인 정보를 파싱해, 적정성을 판단하고, 안내 산출물까지 만들어냅니다. 이 4단계가 모든 인사 앱의 공통 골격입니다."
    >
      <PlannedList
        items={[
          { title: "HRcoach, AI인사앱 소개", desc: "AI 주도 인사 업무 혁신과 효율화 소개" },
          { id: "tutorial", title: "시각화 튜토리얼", desc: "앱 조합 및 결과물 도출 과정을 인포그래픽으로 안내" },
          { id: "playbook", title: "활용 노하우", desc: "기업 규모·산업별 베스트 프랙티스 (블로그 형태)" },
        ]}
      />
    </SectionShell>
  );
}
