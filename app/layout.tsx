import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GIT Members",
  description: "評価、月次PL、粗利差異、給与改定連動を一元管理する社内Webシステム",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}