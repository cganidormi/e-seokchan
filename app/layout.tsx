import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "이석찬",
  description: "기숙사 이석/외박 관리 시스템",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  }
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ scrollbarGutter: 'stable', overflowY: 'scroll' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegister />
        {children}
        <div id="datepicker-portal" />
      </body>
    </html>
  );
}
