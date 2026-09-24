import type { MetadataRoute } from "next";

/** 로그인 후 화면과 시안·관리자 경로는 색인에서 제외한다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/workspace", "/payment", "/draft", "/api/"],
    },
    sitemap: "https://hrcoach.co.kr/sitemap.xml",
  };
}
