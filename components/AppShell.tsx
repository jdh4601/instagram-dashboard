"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { reelIdFromPathname, shouldShowChatPanel } from "@/lib/chat/panelRoute";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div className="md:sticky md:top-0 md:self-start">
        <Sidebar pathname={pathname} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {/* 레이아웃에 있어야 페이지를 옮겨도 리마운트되지 않는다 — 진행 중인 답변과
          접기 상태가 이동 중에도 그대로 남는다. */}
      {shouldShowChatPanel(pathname) && <ChatPanel reelId={reelIdFromPathname(pathname)} />}
    </div>
  );
}
