import type { MetadataRoute } from "next";

/**
 * 검색엔진에 노출할 공개 페이지 목록.
 * 예전에는 public/sitemap.xml 에 vercel.app 주소로 5개만 적혀 있었는데,
 * 도메인이 hrcoach.co.kr 로 바뀌고 페이지도 늘어 여기서 한 곳으로 관리한다.
 * 로그인 후에만 의미가 있는 화면(작업실·결제·관리자)과 시안 페이지는 넣지 않는다.
 */
const BASE = "https://hrcoach.co.kr";

const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/solution", priority: 0.9, changeFrequency: "monthly" },
  { path: "/solution/methodology", priority: 0.8, changeFrequency: "monthly" },
  { path: "/apps", priority: 0.9, changeFrequency: "weekly" },
  { path: "/premium", priority: 0.6, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/lab", priority: 0.6, changeFrequency: "monthly" },
  { path: "/requests", priority: 0.6, changeFrequency: "weekly" },
  { path: "/support", priority: 0.6, changeFrequency: "monthly" },
  { path: "/tools/ats", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tools/eval", priority: 0.7, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" },
  { path: "/signup", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/refund", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/support", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
