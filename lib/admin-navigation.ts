// 헤더와 계정 메뉴가 같은 경로·이름을 사용하도록 한곳에서 관리한다.
export const ADMIN_NAV = [
  { label: "앱 목록", href: "/admin/applist" },
  { label: "앱 빌더", href: "/admin/builder" },
  { label: "사용량 집계", href: "/admin/usage" },
  { label: "회원·구독 관리", href: "/admin/members" },
  { label: "리포트 설정", href: "/admin/report-guide" },
] as const;
export function adminNavActive(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(href + "/") ||
    (href === "/admin/report-guide" && pathname === "/admin/report-lab")
  );
}
