import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura — 사주팔자 AI 운명 상담",
  description: "사주팔자 기반 AI 운명 상담 서비스 Aura",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
