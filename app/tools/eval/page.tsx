"use client";

import { useRouter } from "next/navigation";
import EvalCollector from "../../components/EvalCollector";

export default function EvalPage() {
  const router = useRouter();
  return <EvalCollector onBack={() => router.push("/")} />;
}
