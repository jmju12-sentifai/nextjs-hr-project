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

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, status, expires_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const active =
    !!sub && (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());

  if (!active) {
    redirect(`/pricing?next=${encodeURIComponent(nextPath)}`);
  }

  return <>{children}</>;
}
