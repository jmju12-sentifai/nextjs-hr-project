import Ecosystem from "../components/home/Ecosystem";
import HomeView from "../components/home/HomeView";
import HowItWorks from "../components/home/HowItWorks";

export const metadata = {
  title: "메인 섹션 추가 시안 — HRcoach",
  robots: { index: false, follow: false },
};

/**
 * 운영 홈(/)과 같은 화면에 5단계 흐름·상생 구조 섹션을 더한 미리보기.
 * 확정되면 app/page.tsx 에 같은 extraSections 를 넘기면 된다.
 */
export default function PreviewHome() {
  return (
    <HomeView
      extraSections={
        <>
          <HowItWorks />
          <Ecosystem />
        </>
      }
    />
  );
}
