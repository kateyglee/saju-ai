import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "命理 AI — 사주팔자 AI 상담",
  description: "사주팔자를 기반으로 한 AI 명리 상담 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
