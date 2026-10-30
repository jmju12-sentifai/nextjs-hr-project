import { DEFAULT_REPORT_GUIDE, validateReportGuide } from "app-renderer";
import { createAdminClient } from "@/lib/supabase/admin";

export async function readReportGuide() {
  const { data, error } = await createAdminClient().from("site_settings")
    .select("value").eq("key", "report_guide").maybeSingle();
  // 마이그레이션 전 배포에서도 기존 문서를 계속 볼 수 있도록 기본값을 쓴다.
  if (error && ["42P01", "PGRST205"].includes(error.code))
    return { guide: DEFAULT_REPORT_GUIDE, available: false };
  if (error) throw new Error("공통 가이드를 불러오지 못했습니다.");
  if (data && !validateReportGuide(data.value)) throw new Error("저장된 공통 가이드를 확인해 주세요.");
  return { guide: data?.value ?? DEFAULT_REPORT_GUIDE, available: true };
}
