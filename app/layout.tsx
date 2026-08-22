import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Footer from "./components/Footer";
import HeroTheme from "./components/home/HeroTheme";

const geistSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "HR Coach",
  description: "HR analysis app builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--sec-bg)] font-sans text-[var(--sec-fg)]">
        <HeroTheme>
          <div className="flex-1">{children}</div>
          <Footer />
        </HeroTheme>
      </body>
    </html>
  );
}
