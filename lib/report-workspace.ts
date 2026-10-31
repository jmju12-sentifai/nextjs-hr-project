import type { AppSchema, ReportDoc } from "app-renderer";

/** 새 제안에도 현재 초안의 잠금과 문구를 전달하고 다른 경로는 그대로 둔다. */
export function withWorkingDoc(schema: AppSchema, pathId: string, doc?: ReportDoc): AppSchema {
  if (!doc) return schema;
  return {
    ...schema,
    paths: schema.paths?.map(path => path.id === pathId ? { ...path, doc } : path),
    ...(schema.fallback?.id === pathId ? { fallback: { ...schema.fallback, doc } } : {}),
  };
}
