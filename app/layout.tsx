import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "타마누를 살려라",
  description: "지하수위를 조절해 타마누 묘목을 최적 환경에서 키워보세요. NIFoS-UNSRI 공동연구 기반 교육용 미니게임.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "타마누를 살려라",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a2f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
