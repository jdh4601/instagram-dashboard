import type { HookCategory, HookDraft, HookType, Reel, ReelAnalysis } from "@/lib/schemas";

/**
 * 분석이 붙인 훅 유형(7종)을 훅 저장소의 분류(5종)로 옮긴다.
 *
 * 두 목록은 만든 목적이 다르다 — 분석은 대본에서 관찰한 도입 방식이고, 저장소의
 * 5종은 나중에 훅을 찾아 쓸 때 쓰는 서랍이다. 그래서 합치지 않고 여기서만 잇는다.
 * how-to는 "이 문제를 이렇게 푼다"는 약속이라 문제 제기 쪽에, 어디에도 걸리지
 * 않은 other는 일단 호기심으로 둔다. 어느 쪽이든 저장 후 보관함에서 고칠 수 있다.
 */
export const ANALYSIS_HOOK_CATEGORY: Record<HookType, HookCategory> = {
  problem: "problem",
  contrarian: "contrarian",
  "personal-experience": "experience",
  curiosity: "curiosity",
  "result-proof": "authority",
  "how-to": "problem",
  other: "curiosity",
};

// 훅 문장은 저장 스키마의 한도와 같은 값이다. 넘겨서 400을 받느니 여기서 줄여 담는다.
const MAX_TEXT = 200;
// 메모는 스키마 한도(1000)보다 훨씬 짧게 끊는다. 보관함 목록에서 훅 문장 아래
// 한 줄로 붙는 자리라, 길면 훅보다 메모가 눈에 먼저 들어온다.
const MAX_NOTE = 120;

function clamp(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/** 저장된 값이 <a href>·<img src>로 그대로 걸리므로 http(s)가 아니면 버린다. */
function httpOnly(url: string | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

/**
 * 릴스 분석 결과에서 훅 보관함에 담을 초안을 만든다.
 *
 * 화면이 이미 보고 있는 값만 옮긴다 — 저장 버튼이 새로 LLM을 부르면 같은 훅에
 * 두 가지 문장이 생겨 분석 탭과 보관함이 어긋난다.
 * 훅 문장이 비어 있으면 담을 게 없다는 뜻이라 null을 준다.
 */
export function buildHookDraftFromReel(reel: Reel, analysis: ReelAnalysis): HookDraft | null {
  const { hook } = analysis;
  const text = clamp(hook.line, MAX_TEXT);
  if (!text) return null;

  // 메모는 "왜 먹히는가" 한 줄뿐이다. 재사용 템플릿은 분석 탭에 그대로 있고,
  // 라벨을 붙이면 목록에서 훅 문장보다 메모가 길어진다.
  const note = clamp(hook.why.replace(/\s+/g, " "), MAX_NOTE);

  return {
    text,
    category: ANALYSIS_HOOK_CATEGORY[hook.type],
    sourceUrl: httpOnly(reel.permalink),
    thumbnailUrl: httpOnly(reel.thumbnailUrl),
    views: reel.views,
    note: note || undefined,
    isFavorite: false,
  };
}
