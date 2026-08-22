/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./packages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 홈페이지 시안 토큰 (docs/homepage-refs/HRcoach_히어로_V6_칩통합.html)
        brand: {
          blue: "#1858f2",
          blue2: "#0e42d9",
          ink: "#071a3b",
          sky: "#80d8f7",
          lime: "#d8ff22",
          line: "#d9e3ef",
          muted: "#718099",
          shell: "#eaf0f7",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        // 기존 코드에서 사용되는 font-serif도 Geist로 폴백
        serif: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
