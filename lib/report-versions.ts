import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportDoc } from "app-renderer";

export const isMissingVersionStore = (error: { code?: string } | null) => !!error && ["42P01", "PGRST205", "PGRST202", "42883"].includes(error.code || "");

export async function saveDraft(appId: string, pathId: string, doc: ReportDoc, note: string, userId: string) {
  const { data, error } = await createAdminClient().rpc("save_report_doc_draft", {
    p_app_id: appId, p_path_id: pathId, p_doc: doc, p_note: note.slice(0, 500), p_actor: userId,
  });
  if (isMissingVersionStore(error)) return { version: null, storage: "unavailable" as const };
  if (error) throw new Error("초안 이력을 저장하지 못했습니다.");
  return { version: data, storage: "server" as const };
}
