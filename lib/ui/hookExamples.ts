/**
 * 이미 분석된 릴스의 훅을 카탈로그의 7유형에 붙이기 위한 묶음.
 *
 * 카탈로그의 예시는 남의 문장이라 "나도 저렇게 되나"가 안 붙는다. 내 계정에서
 * 실제로 나온 훅을 같은 유형 아래 놓으면 템플릿과 내 문장을 나란히 볼 수 있다.
 * 새 데이터를 만들지 않고 `reel.reelAnalysis.hook`을 다시 쓰는 게 요점이다.
 */

import type { HookType } from "@/lib/schemas/reelAnalysis";
import type { Reel } from "@/lib/schemas";
import { reelTitle } from "@/lib/ui/reelTitle";

export interface HookExample {
  reelId: string;
  reelTitle: string;
  /** 첫 3초에 실제로 나온 문장 */
  line: string;
  /** 다른 주제에 갈아 끼울 수 있게 일반화한 형태 */
  template: string;
  why: string;
  permalink?: string;
}

export type HookExamplesByType = Record<HookType, HookExample[]>;

function emptyGroups(): HookExamplesByType {
  // 유형 칸을 미리 다 만들어 둬야 화면에서 `groups[type]`이 undefined가 되지 않는다.
  // HOOK_TYPES를 돌려 만들지 않고 손으로 적는 이유: 유형이 늘면 여기서 컴파일이
  // 깨져 카탈로그에 칸을 추가하라고 알려 준다.
  return {
    problem: [],
    contrarian: [],
    "personal-experience": [],
    curiosity: [],
    "result-proof": [],
    "how-to": [],
    other: [],
  };
}

export function groupHookExamplesByType(reels: readonly Reel[]): HookExamplesByType {
  const analyzed = reels.filter((reel) => reel.reelAnalysis);
  // 최신 게시물이 위로. 옛날 훅이 먼저 보이면 지금 쓰는 화법과 어긋난다.
  const ordered = [...analyzed].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  return ordered.reduce<HookExamplesByType>((groups, reel) => {
    const hook = reel.reelAnalysis?.hook;
    if (!hook) return groups;

    const example: HookExample = {
      reelId: reel.id,
      reelTitle: reelTitle(reel),
      line: hook.line,
      template: hook.template,
      why: hook.why,
      permalink: reel.permalink,
    };
    return { ...groups, [hook.type]: [...groups[hook.type], example] };
  }, emptyGroups());
}
