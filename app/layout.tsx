import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GIT Members",
  description: "評価、月次PL、粗利差異、給与改定連動を一元管理する社内Webシステム",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if ("serviceWorker" in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function (registrations) {
                      registrations.forEach(function (registration) {
                        registration.unregister();
                      });
                    });
                  }
                  if ("caches" in window) {
                    window.caches.keys().then(function (keys) {
                      keys.forEach(function (key) {
                        window.caches.delete(key);
                      });
                    });
                  }
                } catch (error) {
                  console.warn("PWA cleanup skipped", error);
                }
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
