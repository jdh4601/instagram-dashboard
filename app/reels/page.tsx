import { MediaFeed } from "@/components/MediaFeed";

export default function ReelsPage() {
  return (
    <MediaFeed
      title="릴스"
      description="릴스를 검색·정렬하고 상세 분석으로 들어갑니다."
      filter="REELS"
    />
  );
}
