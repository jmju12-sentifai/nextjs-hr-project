"use server";

import type { ReportIssuer } from "app-renderer";
import { createClient } from "@/lib/supabase/server";

const clip = (v: unknown) => String(v ?? "").trim().slice(0, 80);

/** 리포트 발행 정보를 로그인한 사용자의 메타데이터(report_issuer)에 저장한다. */
export async function saveIssuer(input: ReportIssuer): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const report_issuer: ReportIssuer = {
    company: clip(input.company),
    dept: clip(input.dept),
    contact: clip(input.contact),
  };
  const { error } = await supabase.auth.updateUser({ data: { report_issuer } });
  return error ? { error: error.message } : {};
}
