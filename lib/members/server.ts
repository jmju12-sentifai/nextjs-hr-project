import { createAdminClient } from "@/lib/supabase/admin";
import type { Member } from "./types";
export async function memberOverview(userId: string): Promise<Member | null> {
  const { data, error } = await createAdminClient()
    .from("admin_member_overview")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error)
    throw new Error(
      "회원 이용 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  return data;
}
export async function hasMemberAccess(userId: string) {
  return !!(await memberOverview(userId))?.active;
}
export function memberActionError(error: { message?: string; code?: string }) {
  if (
    ["42501", "42P01", "42883", "PGRST202", "PGRST205"].includes(
      error.code || "",
    )
  )
    return "회원 관리 설정을 확인해야 합니다. 요청한 처리는 반영되지 않았습니다.";
  const text = error.message || "";
  const messages: Record<string, string> = {
    STATE_CHANGED:
      "다른 처리가 반영되었습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
    BILLING_BUSY:
      "결제 처리 결과를 확인 중입니다. 처리가 끝난 뒤 다시 시도해 주세요.",
    MEMBER_NOT_FOUND: "회원을 찾을 수 없습니다.",
    SUBSCRIPTION_NOT_FOUND: "변경할 유료 구독이 없습니다.",
    GRANT_EXISTS:
      "이용 중이거나 예정된 무료 제공이 있습니다. 해당 제공을 회수한 뒤 변경해 주세요.",
    GRANT_NOT_FOUND: "이미 회수되었거나 없는 무료 제공입니다.",
    INVALID_END: "종료일은 이용 시작일보다 늦어야 합니다.",
    REASON_REQUIRED: "처리 사유를 입력해 주세요.",
    INVALID_INPUT: "입력 내용을 확인해 주세요.",
    ALREADY_SUBSCRIBED: "이미 이용 중인 유료 구독이 있습니다.",
  };
  return (
    Object.entries(messages).find(([key]) => text.includes(key))?.[1] ||
    "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
  );
}
