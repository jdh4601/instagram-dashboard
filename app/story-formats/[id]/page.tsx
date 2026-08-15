import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { STORY_FORMATS, getStoryFormat } from "@/lib/analysis/storyFormats";
import { StoryFormatDetail } from "@/components/StoryFormatDetail";

interface Props {
  params: Promise<{ id: string }>;
}

// 포맷은 코드 안의 상수라 열 종을 미리 다 만들어 둔다.
export function generateStaticParams() {
  return STORY_FORMATS.map((format) => ({ id: format.id }));
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const format = getStoryFormat(id);
  return { title: format ? `${format.label} — 스토리텔링 포맷` : "스토리텔링 포맷" };
}

export default async function StoryFormatDetailPage({ params }: Props) {
  const { id } = await params;
  const format = getStoryFormat(id);
  // 주소를 손으로 고쳐 들어온 경우다. 빈 화면 대신 404로 분명히 알린다.
  if (!format) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <Link
        href="/story-formats"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-neutral-600 transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <ArrowLeft size={15} aria-hidden />
        스토리텔링 포맷
      </Link>

      <StoryFormatDetail format={format} />
    </main>
  );
}
