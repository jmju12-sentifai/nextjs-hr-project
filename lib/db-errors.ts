/**
 * 마이그레이션을 아직 적용하지 않은 환경에서는 PostgREST 가
 * 42P01(relation does not exist)을 돌려준다.
 * 페이지를 죽이지 않고 "준비 중" 안내로 갈아끼우기 위해 이 신호를 따로 구분한다.
 *
 * "use server" 파일은 모든 export 가 async 여야 해서 동기 헬퍼는 여기 둔다.
 */
export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  return e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "");
}
