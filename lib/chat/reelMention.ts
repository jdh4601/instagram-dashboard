import type { Reel } from "@/lib/schemas";

/**
 * 한 질문에 딸려 보낼 게시물 상세의 최대 개수. 자막까지 붙으면 게시물 하나가
 * 계정 요약 전체만큼 커질 수 있어 좁게 잠근다.
 */
export const MAX_MENTIONED_REELS = 2;

/** 두 글자 미만 토큰은 우연히 겹치기 쉬워 매칭 근거로 쓰지 않는다. */
const MIN_TOKEN_LENGTH = 2;

/** 이 점수 미만이면 "그냥 같은 단어를 쓴 것"으로 보고 확장하지 않는다. */
const MIN_SCORE = 2;

/** 접두 일치로 인정할 최소 공통 길이. 한 글자 겹침은 우연이다. */
const MIN_PREFIX_MATCH = 2;

// 조사·지시어처럼 어느 문장에나 나오는 말은 매칭 근거가 될 수 없다.
const STOPWORDS = new Set([
  "이거", "저거", "그거", "이번", "지난", "요즘", "최근", "계정", "콘텐츠", "게시물",
  "릴스", "영상", "성과", "지표", "분석", "어때", "어땠어", "어떻게", "이래", "저래",
  "무엇", "뭐야", "왜냐", "그리고", "하지만", "내가", "나의", "우리", "때문",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/u)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token));
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i;
}

/**
 * 캡션 토큰과 질문 토큰의 겹침 점수.
 *
 * 한국어는 조사가 붙어 어형이 달라지므로("가격" vs "가격을") 정확 일치로는 거의
 * 잡히지 않는다. 앞에서부터 겹치는 길이를 점수로 쓰면 어간이 같은 말을 잡아내면서
 * 긴 겹침일수록 높은 점수를 준다.
 */
function overlapScore(messageTokens: string[], caption: string | undefined): number {
  if (!caption) return 0;
  const captionTokens = tokenize(caption);
  let score = 0;
  for (const token of new Set(messageTokens)) {
    const best = captionTokens.reduce(
      (max, captionToken) => Math.max(max, commonPrefixLength(token, captionToken)),
      0,
    );
    if (best >= MIN_PREFIX_MATCH) score += best;
  }
  return score;
}

/**
 * 사용자 메시지가 특정 게시물을 지목했는지 결정적으로 판별한다.
 *
 * ID가 그대로 적혀 있으면 그것만 신뢰한다. 그 외에는 캡션 토큰 겹침 점수로 고르되,
 * 임계값을 넘지 못하면 아무것도 돌려주지 않는다 — 일반적인 계정 질문에 엉뚱한
 * 게시물이 딸려가면 모델이 질문 대상을 오해하기 때문이다.
 */
export function findMentionedReels(message: string, reels: Reel[]): Reel[] {
  if (!message.trim() || reels.length === 0) return [];

  const byId = reels.filter((reel) => message.includes(reel.id));
  if (byId.length > 0) return byId.slice(0, MAX_MENTIONED_REELS);

  const messageTokens = tokenize(message);
  if (messageTokens.length === 0) return [];

  return reels
    .map((reel) => ({ reel, score: overlapScore(messageTokens, reel.caption) }))
    .filter((candidate) => candidate.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.reel.postedAt.localeCompare(a.reel.postedAt))
    .slice(0, MAX_MENTIONED_REELS)
    .map((candidate) => candidate.reel);
}

/**
 * 질문이 지목한 게시물에, 질문할 때 열어 두고 있던 게시물을 합친다.
 *
 * 상세 화면에서는 "이거 훅 왜 약해?"처럼 대상을 말로 밝히지 않는다. 화면이 이미
 * 대상을 정해 놓았기 때문이다. 그래서 열어 둔 릴스를 맨 앞에 세우고, 캡션으로
 * 걸린 것들을 뒤에 붙인 다음 같은 상한으로 자른다.
 */
export function selectContextReels(
  message: string,
  openReelId: string | null | undefined,
  reels: Reel[],
): Reel[] {
  const mentioned = findMentionedReels(message, reels);
  const open = openReelId ? reels.find((reel) => reel.id === openReelId) : undefined;
  if (!open) return mentioned;

  return [open, ...mentioned.filter((reel) => reel.id !== open.id)].slice(0, MAX_MENTIONED_REELS);
}
