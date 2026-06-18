// 관리자 판별 — ADMIN_EMAILS 환경변수(쉼표 구분)에 등록된 이메일만 관리자.
// 서버 컴포넌트·미들웨어(엣지)·API 어디서나 쓸 수 있도록 순수 함수로 둠.
// 관리자 계정 추가: 해당 이메일로 회원가입한 뒤 .env.local 의 ADMIN_EMAILS 에 이메일을 넣으면 됨.
//   예) ADMIN_EMAILS=admin@hrcoach.ai
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
