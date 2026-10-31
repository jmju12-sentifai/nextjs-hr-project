import { migrateSchema, stableJson, validateDoc } from "app-renderer";
import type { AppSchema, ReportDoc, ReportGuide } from "app-renderer";
import type { ChatMessage, DocChange } from "./report-edit";
import type { ReportProposal } from "./report-proposals";

export interface ReportChatState {
  draft: ReportDoc; messages: ChatMessage[]; input: string; selectedId: string | null;
  changes: DocChange[]; panel: "preview" | "chat"; previewKey?: string;
}
export interface ReportWorkspace {
  format: 1; calculation: string; savedDoc: string; docMode: boolean;
  proposals: ReportProposal[]; selected: number; sourceDoc?: ReportDoc;
  guide?: ReportGuide; chat?: ReportChatState;
}

/** 양식 선택만으로 복원 기록이 무효화되지 않도록 계산 구성과 문서를 구분한다. */
export function reportCalculationKey(raw: AppSchema) {
  const schema = migrateSchema(raw);
  const withoutDoc = ({ doc, ...path }: NonNullable<AppSchema["paths"]>[number]) => path;
  return stableJson({ ...schema, paths: schema.paths?.map(withoutDoc), fallback: schema.fallback && withoutDoc(schema.fallback) });
}
export function reportSavedDoc(schema: AppSchema, pathId: string) {
  return stableJson([...(schema.paths || []), ...(schema.fallback ? [schema.fallback] : [])].find(p => p.id === pathId)?.doc || null);
}
export function validWorkspace(value: unknown, schema: AppSchema, pathId: string): value is ReportWorkspace {
  const w = value as ReportWorkspace | null;
  if (!w || w.format !== 1 || w.calculation !== reportCalculationKey(schema) || typeof w.savedDoc !== "string"
    || typeof w.docMode !== "boolean" || !Array.isArray(w.proposals) || w.proposals.length > 3
    || !Number.isInteger(w.selected) || w.selected < 0 || (w.proposals.length > 0 && w.selected >= w.proposals.length)) return false;
  const validDoc = (doc: ReportDoc, empty = false) => empty && Array.isArray(doc?.blocks) && !doc.blocks.length
    || validateDoc(schema, pathId, doc, { previous: doc }).ok;
  if (w.proposals.some(p => !p || typeof p.id !== "string" || typeof p.name !== "string" || typeof p.reason !== "string" || !validDoc(p.doc))) return false;
  if (w.sourceDoc && !validDoc(w.sourceDoc)) return false;
  if (w.chat && (!validDoc(w.chat.draft, true) || !Array.isArray(w.chat.messages) || w.chat.messages.length > 40
    || w.chat.messages.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string"
      || (m.suggestions !== undefined && (!Array.isArray(m.suggestions) || m.suggestions.length > 3
        || m.suggestions.some(s => !s || typeof s.label !== "string" || typeof s.description !== "string" || typeof s.blockId !== "string" || !s.block)
        || !m.sourceDoc || !validDoc(m.sourceDoc))))
    || typeof w.chat.input !== "string" || w.chat.input.length > 2000 || !Array.isArray(w.chat.changes)
    || !["preview", "chat"].includes(w.chat.panel))) return false;
  return true;
}

/** 새 제안에도 현재 초안의 잠금과 문구를 전달하고 다른 경로는 그대로 둔다. */
export function withWorkingDoc(schema: AppSchema, pathId: string, doc?: ReportDoc): AppSchema {
  if (!doc) return schema;
  return {
    ...schema,
    paths: schema.paths?.map(path => path.id === pathId ? { ...path, doc } : path),
    ...(schema.fallback?.id === pathId ? { fallback: { ...schema.fallback, doc } } : {}),
  };
}
