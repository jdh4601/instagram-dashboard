"use client";
import { useParams } from "next/navigation";
import { MediaDetailScreen } from "@/components/MediaDetailScreen";

// 캐러셀 상세는 릴스와 경로를 나눈다. 사이드바가 경로만 보고 탭을 켜기 때문에,
// 한 경로를 나눠 쓰면 캐러셀을 눌러도 릴스 탭이 켜진다(lib/ui/navigation.ts).
export default function CarouselDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <MediaDetailScreen id={id} kind="CAROUSEL" />;
}
