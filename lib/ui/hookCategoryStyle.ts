import type { HookCategory } from "@/lib/schemas";

/**
 * 훅 분류 배지의 색.
 *
 * 다섯 분류가 모두 같은 브랜드색이면 라벨 글자를 읽기 전에는 유형을 못 가른다.
 * 보관함은 훑어보는 화면이라 그 한 박자가 곧 쓸모다. 진단 밴드(약점·보통·강점)와
 * 달리 좋고 나쁨이 없는 분류색이므로 색상환을 고루 쓴다.
 *
 * 팔레트는 globals.css의 테마 토큰이다. 여기서 색을 하드코딩하면 다크 테마에서
 * 대비가 무너진다.
 */
export const HOOK_CATEGORY_CLASSES: Record<HookCategory, string> = {
  problem: "bg-hook-problem-soft text-hook-problem",
  contrarian: "bg-hook-contrarian-soft text-hook-contrarian",
  experience: "bg-hook-experience-soft text-hook-experience",
  curiosity: "bg-hook-curiosity-soft text-hook-curiosity",
  authority: "bg-hook-authority-soft text-hook-authority",
};
