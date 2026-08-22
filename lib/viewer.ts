import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/** 헤더가 필요로 하는 최소 인증 정보. 서버 컴포넌트에서만 호출한다. */
export async function getViewer(): Promise<{ email: string | null; isAdmin: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { email: user?.email ?? null, isAdmin: isAdminEmail(user?.email) };
}
