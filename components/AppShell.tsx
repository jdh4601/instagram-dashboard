"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div className="md:sticky md:top-0 md:self-start">
        <Sidebar pathname={pathname ?? "/"} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
