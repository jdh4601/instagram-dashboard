"use client";
import { Sparkles } from "lucide-react";

// 이 대시보드가 실제로 답할 수 있는 질문만 고정한다. 데이터에 없는 것을 유도하면
// 첫 대화부터 "데이터 부족"만 돌아온다.
const SUGGESTIONS = [
  "지금 내 계정의 병목은 어디야?",
  "최근 2주 성과를 진단해줘",
  "도달은 나오는데 팔로우가 안 붙는 이유는?",
  "다음 릴스는 뭘 만들어야 해?",
];

interface ChatSuggestionsProps {
  disabled: boolean;
  onPick: (question: string) => void;
}

export function ChatSuggestions({ disabled, onPick }: ChatSuggestionsProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-800">
        <Sparkles size={16} className="text-brand-600" />
        계정 진단 AI
      </div>
      <p className="mb-4 text-sm leading-relaxed text-neutral-500">
        이 계정의 지표·퍼널·게시물 성과를 모두 읽고 있습니다. 상태, 병목, 개선점을 물어보세요.
      </p>
      <div className="space-y-2">
        {SUGGESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onPick(question)}
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
