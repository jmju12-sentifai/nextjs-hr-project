import { createClient as createBase } from "@supabase/supabase-js";

// 서비스 롤 키 클라이언트 — RLS 우회. 서버에서만 사용. 절대 클라이언트로 노출 금지.
// 결제 승인 후 subscriptions 작성, 구독 취소 등 권한 작업에 사용.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 미설정");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정 (.env.local)");
  return createBase(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
