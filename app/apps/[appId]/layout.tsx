import { hasMemberAccess } from "@/lib/members/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 서버 단 게이트 — JS 무관 강제
//   1) 비로그인 → /login?next=/apps/[appId]
//   2) 로그인 했으나 active 구독 없음 → /pricing?next=/apps/[appId]
export default async function AppGuard({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { appId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = `/apps/${params.appId}`;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const active = await hasMemberAccess(user.id);

  if (!active) {
    redirect(`/pricing?next=${encodeURIComponent(nextPath)}`);
  }

  return <>{children}</>;
}
