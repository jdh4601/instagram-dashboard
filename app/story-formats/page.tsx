import { STORY_FORMATS } from "@/lib/analysis/storyFormats";
import { StoryFormatGrid } from "@/components/StoryFormatGrid";
import { SavedStoryFormatLibrary } from "@/components/SavedStoryFormatLibrary";

export default function StoryFormatsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">스토리텔링 포맷</h1>
        <p className="text-sm text-neutral-600">
          릴스에서 담아 둔 판정 보관함과, 포맷 {STORY_FORMATS.length}종의 카탈로그입니다.
          카탈로그에서 하나를 고르면 아웃라이어 조건과 비트 시퀀스를 펼쳐 봅니다.
        </p>
      </header>

      {/* 보관함이 위다 — 카탈로그는 늘 그대로지만 담은 사례는 볼 때마다 달라진다. */}
      <SavedStoryFormatLibrary />

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">포맷 카탈로그</h2>
        <StoryFormatGrid />
      </section>
    </main>
  );
}
