import { EmptyState } from "@/components/ui";

// 훅 보관함 본체는 후속 작업(스트림 B)에서 채운다. 사이드바 탭이 빈 링크로 남지 않게 자리를 잡아둔다.
export default function HooksPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">훅</h1>
        <p className="text-sm text-neutral-600">잘된 릴스의 훅을 모아두는 보관함입니다.</p>
      </header>

      <EmptyState title="훅 보관함을 준비하고 있습니다." />
    </main>
  );
}
