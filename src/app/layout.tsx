import type { Metadata } from "next";
import "./globals.css";
import { SideNav } from "@/components/side-nav";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = {
  title: "A7 — Trading System",
  description: "A7 — Multi-Strategy Research, Backtest & Live Trading System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "A7",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen">
        <AutoRefresh />
        <div className="flex">
          <SideNav />
          <main className="flex-1 ml-64 p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}