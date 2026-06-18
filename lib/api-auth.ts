import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export type AuthOk = { user: { id: string; email?: string | null } };
export type AuthErr = { error: NextResponse };
export type AuthResult = AuthOk | AuthErr;

// 관리자(ADMIN_EMAILS) 로그인을 요구 — 빌더/기획서 등 admin 전용 API 에 사용
export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "로그인이 필요합니다" },
        { status: 401 }
      ),
    };
  }
  if (!isAdminEmail(user.email)) {
    return {
      error: NextResponse.json(
        { error: "관리자 권한이 필요합니다" },
        { status: 403 }
      ),
    };
  }
  return { user };
}

// 로그인만 요구
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "로그인이 필요합니다" },
        { status: 401 }
      ),
    };
  }
  return { user };
}

// 로그인 + 활성 구독을 요구 — 사용자 앱이 호출하는 비용 API에 사용
export async function requireActiveSubscription(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "로그인이 필요합니다" },
        { status: 401 }
      ),
    };
  }
  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("id, status, expires_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return {
      error: NextResponse.json(
        { error: "구독 조회 실패" },
        { status: 500 }
      ),
    };
  }
  const active =
    !!sub &&
    (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
  if (!active) {
    return {
      error: NextResponse.json(
        { error: "활성 구독이 필요합니다" },
        { status: 402 }
      ),
    };
  }
  return { user };
}
