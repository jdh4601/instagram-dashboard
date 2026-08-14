import { STORY_FORMATS } from "@/lib/analysis/storyFormats";
import { StoryFormatCatalog } from "@/components/StoryFormatCatalog";

export default function StoryFormatsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">스토리텔링 포맷</h1>
        <p className="text-sm text-neutral-600">
          포맷 {STORY_FORMATS.length}종의 비트 시퀀스입니다. 빠진 비트가 곧 대본이 약해지는
          지점입니다.
        </p>
      </header>

      {/* 훅 저장소에 얹혀 있을 땐 접어 뒀지만, 여기서는 이 목록이 화면의 전부라 바로 편다. */}
      <section aria-label="스토리텔링 포맷 카탈로그" className="space-y-3">
        <StoryFormatCatalog />
      </section>
    </main>
  );
}
