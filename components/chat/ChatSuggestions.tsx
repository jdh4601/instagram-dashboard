"use client";
import { Sparkles } from "lucide-react";

// 이 대시보드가 실제로 답할 수 있는 질문만 고정한다. 데이터에 없는 것을 유도하면
// 첫 대화부터 "데이터 부족"만 돌아온다. 각 항목은 buildAccountContext가 프롬프트에
// 싣는 값(퍼널·팔로워/비팔로워 도달·3초 훅 유지율·저장/공유율·최근 20개 게시물)에
// 그대로 대응한다.
//
// 문구를 길게 잡은 이유: "병목이 어디야?" 같은 한 줄은 답도 한 줄로 돌아온다. 비교
// 대상과 원하는 산출물 형태까지 적어 두면 첫 답변부터 실행 가능한 수준으로 온다.
const SUGGESTIONS = [
  "최근 2주 릴스를 그 이전 기간과 비교해서 조회수·저장률·공유율이 어디서 꺾였는지 짚고, 원인 가설을 세 가지로 정리해줘",
  "도달 → 프로필 방문 → 팔로우 퍼널에서 지금 가장 많이 새는 구간이 어디인지 벤치마크 대비 수치로 짚어주고, 그 구간만 손보는 방법을 알려줘",
  "저장률·공유율 상위 3개 게시물과 하위 3개 게시물을 비교해서 훅·주제·길이 중 무엇이 성과를 갈랐는지 근거와 함께 정리해줘",
  "비팔로워 도달 비중이 지금 어느 수준인지 보고, 신규 유입을 늘리려면 다음 릴스에서 무엇을 바꿔야 하는지 구체적으로 제안해줘",
  "3초 훅 유지율이 낮은 게시물들의 공통점을 찾아주고, 그중 하나의 첫 3초 대본을 다시 쓴다면 어떤 문장이 될지 예시로 보여줘",
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
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left text-[13px] leading-relaxed text-neutral-700 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
