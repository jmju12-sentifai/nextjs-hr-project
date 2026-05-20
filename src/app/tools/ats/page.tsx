"use client";

import { useRouter } from "next/navigation";
import ATSAnalyzer from "../../components/ATSAnalyzer";

export default function ATSPage() {
  const router = useRouter();
  return <ATSAnalyzer onBack={() => router.push("/")} />;
}
