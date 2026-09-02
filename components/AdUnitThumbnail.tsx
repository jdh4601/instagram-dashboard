import { ImageOff } from "lucide-react";
import { cn } from "@/components/ui";

interface Props {
  url?: string;
  /** 목록은 작게, 상세는 크게. 비율은 둘 다 9:16으로 고정한다. */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * 광고 썸네일.
 *
 * 릴스는 세로 영상이라 정사각으로 자르면 어느 장면인지 알아보기 어렵다. 9:16을
 * 유지해서 목록만 훑어도 어떤 릴스인지 가려낼 수 있게 한다.
 */
export function AdUnitThumbnail({ url, size = "sm", className }: Props) {
  const box = size === "lg" ? "h-28 w-[63px]" : "h-16 w-9";

  if (!url) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-surface-muted text-neutral-300",
          box,
          className,
        )}
      >
        <ImageOff size={size === "lg" ? 20 : 14} aria-hidden />
      </span>
    );
  }

  // 인스타그램·Meta CDN의 서명 URL이라 Next 이미지 최적화를 태우지 않는다.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={cn("shrink-0 rounded-lg object-cover", box, className)} />;
}
