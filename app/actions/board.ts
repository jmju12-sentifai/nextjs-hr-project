"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/db-errors";

export type ActionResult = { ok: true } | { ok: false; message: string };

function text(fd: FormData, k: string, max = 4000): string {
  return String(fd.get(k) ?? "").trim().slice(0, max);
}

/** 엑셀 6번 "신규 개발 요청 폼" — PSST 4항목 */
export async function submitAppRequest(fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const title = text(fd, "title", 120);
  const problem = text(fd, "problem");
  const solution = text(fd, "solution");
  if (!title || !problem || !solution) {
    return { ok: false, message: "제목·문제·원하는 산출물은 필수입니다." };
  }

  const { error } = await supabase.from("app_requests").insert({
    user_id: user.id,
    title,
    category: text(fd, "category", 40) || null,
    problem,
    solution,
    current_way: text(fd, "current_way") || null,
    usage_note: text(fd, "usage_note") || null,
  });
  if (error) {
    return {
      ok: false,
      message: isMissingTable(error)
        ? "게시판 테이블이 아직 생성되지 않았습니다. 관리자에게 문의해 주세요."
        : "등록에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  revalidatePath("/requests");
  return { ok: true };
}

/** 유저 투표소 — 1인 1표, 다시 누르면 취소 */
export async function toggleVote(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: existing } = await supabase
    .from("app_request_votes")
    .select("request_id")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("app_request_votes")
        .delete()
        .eq("request_id", requestId)
        .eq("user_id", user.id)
    : await supabase
        .from("app_request_votes")
        .insert({ request_id: requestId, user_id: user.id });

  if (error) return { ok: false, message: "처리에 실패했습니다." };
  revalidatePath("/requests");
  return { ok: true };
}

/** 엑셀 7번 — VOC·에러 리포트 / B2B 제휴 제안 / 일반 문의 */
export async function submitInquiry(fd: FormData): Promise<ActionResult> {
  const kindRaw = String(fd.get("kind") ?? "");
  const kind = (["voc", "partnership", "support"] as const).find((k) => k === kindRaw);
  if (!kind) return { ok: false, message: "문의 유형이 올바르지 않습니다." };

  const email = text(fd, "email", 200);
  const subject = text(fd, "subject", 200);
  const body = text(fd, "body", 6000);
  if (!email || !subject || !body) {
    return { ok: false, message: "이메일·제목·내용은 필수입니다." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "이메일 형식을 확인해 주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("inquiries").insert({
    kind,
    user_id: user?.id ?? null,
    name: text(fd, "name", 60) || null,
    email,
    company: text(fd, "company", 120) || null,
    subject,
    body,
  });
  if (error) {
    return {
      ok: false,
      message: isMissingTable(error)
        ? "문의 테이블이 아직 생성되지 않았습니다. besthrcoach@naver.com 으로 보내주세요."
        : "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  revalidatePath("/support");
  return { ok: true };
}
