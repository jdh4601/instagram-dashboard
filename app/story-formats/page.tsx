import { STORY_FORMATS } from "@/lib/analysis/storyFormats";
import { StoryFormatGrid } from "@/components/StoryFormatGrid";

export default function StoryFormatsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">스토리텔링 포맷</h1>
        <p className="text-sm text-neutral-600">
          포맷 {STORY_FORMATS.length}종입니다. 하나를 고르면 아웃라이어 조건과 비트 시퀀스를
          펼쳐 봅니다.
        </p>
      </header>

      <StoryFormatGrid />
    </main>
  );
}
