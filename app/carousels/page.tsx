import { MediaFeed } from "@/components/MediaFeed";

export default function CarouselsPage() {
  return (
    <MediaFeed
      title="캐러셀"
      description="캐러셀 게시물을 검색·정렬하고 상세 분석으로 들어갑니다."
      filter="CAROUSEL"
    />
  );
}
