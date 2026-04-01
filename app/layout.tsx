import type { Metadata, Viewport } from "next";
import "./globals.css";

import { PwaRegistration } from "@/components/pwa-registration";

export const metadata: Metadata = {
  title: "GIT Members",
  description: "評価、月次PL、粗利差異、給与改定連動を一元管理する社内Webシステム",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GIT Members",
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}