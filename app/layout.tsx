import "./globals.css";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export const metadata = { title: "릴스 분석 대시보드" };

const themeScript = `
  try {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", saved === "dark" || (!saved && prefersDark));
  } catch {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-neutral-50 text-neutral-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
