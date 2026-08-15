import Link from "next/link";
import {
  LayoutDashboard,
  Film,
  GalleryHorizontalEnd,
  Anchor,
  BookOpen,
  Settings,
} from "lucide-react";
import { NAV_ITEMS, isNavItemActive } from "@/lib/ui/navigation";
import { cn } from "@/components/ui";

const ICONS = {
  "/": LayoutDashboard,
  "/reels": Film,
  "/carousels": GalleryHorizontalEnd,
  "/hooks": Anchor,
  "/story-formats": BookOpen,
  "/settings": Settings,
} as const;

interface SidebarProps {
  pathname: string;
}

// 현재 경로는 클라이언트 훅으로 읽지 않고 prop으로 받는다 — 렌더 결과를 그대로 테스트할 수 있다.
export function Sidebar({ pathname }: SidebarProps) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="flex shrink-0 gap-1 border-border-subtle bg-surface p-2 max-md:overflow-x-auto max-md:border-b md:h-dvh md:w-48 md:flex-col md:gap-0.5 md:border-r md:p-3"
    >
      <span className="hidden px-2 pb-3 text-sm font-semibold text-neutral-900 md:block">
        릴스 분석
      </span>

      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item);
        const Icon = ICONS[item.href as keyof typeof ICONS];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              active
                ? "bg-brand-600 text-white"
                : "text-neutral-600 hover:bg-surface-muted hover:text-neutral-900",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
