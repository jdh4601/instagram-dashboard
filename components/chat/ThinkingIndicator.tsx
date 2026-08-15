"use client";
import { useEffect, useState } from "react";
import { THINKING_STAGES, THINKING_STAGE_MS, thinkingStageAt } from "@/lib/ui/thinkingStatus";

/** 문구를 바꾸는 주기가 아니라 시계를 읽는 주기다. 경계에 늦어도 0.4초 안에 닿는다. */
const TICK_MS = 400;

/** 마지막 단계에 닿는 시각. 여기부터는 문구가 고정이라 타이머를 더 돌릴 이유가 없다. */
const LAST_STAGE_AT = THINKING_STAGE_MS * (THINKING_STAGES.length - 1);

/**
 * 첫 토큰이 오기 전까지 보여주는 진행 표시.
 *
 * 경과 시간을 재서 문구를 고르는 이유: setTimeout을 단계마다 이어 붙이면 탭이 백그라운드로
 * 내려가 타이머가 밀렸을 때 순서가 어긋난다. 시계를 읽으면 몇 번을 건너뛰든 지금 시점에
 * 맞는 단계가 나온다.
 */
export function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const next = Date.now() - startedAt;
      setElapsed(next);
      if (next >= LAST_STAGE_AT) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const stage = thinkingStageAt(elapsed);

  return (
    <p role="status" className="flex items-center gap-2 text-neutral-400">
      {/* 보조기기에는 바뀌는 단계마다 다시 읽어 주지 않는다. 진행 중이라는 사실 하나면
          충분하고, 2초마다 끼어드는 낭독은 방해가 된다. */}
      <span className="sr-only">진단하는 중</span>
      {/* key가 바뀌면 노드가 새로 붙어 등장 애니메이션이 다시 돈다. */}
      <span key={stage} aria-hidden className="thinking-text">
        {stage}
      </span>
      <span aria-hidden className="flex items-end gap-[3px] pb-[3px]">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </span>
    </p>
  );
}
