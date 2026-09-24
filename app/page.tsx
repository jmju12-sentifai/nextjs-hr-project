import Ecosystem from "./components/home/Ecosystem";
import HomeView from "./components/home/HomeView";
import HowItWorks from "./components/home/HowItWorks";

export default function Home() {
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
