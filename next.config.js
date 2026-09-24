/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["app-renderer"],
  // 우 대표님께 메일로 보낸 시안 주소 — 확정 후 실제 페이지로 넘긴다.
  async redirects() {
    return [
      { source: "/preview", destination: "/", permanent: false },
      { source: "/preview/methodology", destination: "/solution/methodology", permanent: false },
    ];
  },
};

module.exports = nextConfig;
