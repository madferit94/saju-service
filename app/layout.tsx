import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "나의 대운, 나의 시간",
  description: "개인별 대운으로 지나온 시간과 앞으로의 흐름을 살펴보세요.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
