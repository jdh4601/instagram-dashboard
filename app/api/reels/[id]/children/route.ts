import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { getInstagramClient } from "@/lib/graph";
import { mediaKindOf } from "@/lib/media/kind";

/**
 * 캐러셀 낱장(2장째 이후) 주소.
 *
 * 동기화 때 받아 저장하지 않는다. Graph가 주는 media_url은 서명이 만료되는 CDN
 * 주소라 며칠 뒤 상세를 열면 깨진 이미지만 남는다 — 영상 받기(getMediaUrl)와 같은
 * 이유로, 화면이 필요할 때 그 시점의 주소를 다시 물어본다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reel = await getRepository().get(id);
  if (!reel) return NextResponse.json({ error: "게시물을 찾을 수 없습니다" }, { status: 404 });
  if (mediaKindOf(reel) !== "CAROUSEL") {
    return NextResponse.json({ error: "캐러셀 게시물이 아닙니다" }, { status: 400 });
  }

  // 토큰 미설정은 사용자가 설정에서 고칠 수 있는 문제다. Graph 실패(502)와 구분한다.
  let client;
  try {
    client = await getInstagramClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Instagram 연결을 확인해 주세요";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!client.getCarouselChildren) {
    return NextResponse.json(
      { error: "이 Graph 클라이언트는 캐러셀 낱장을 조회할 수 없습니다" },
      { status: 500 },
    );
  }

  try {
    const slides = await client.getCarouselChildren(id);
    return NextResponse.json({ slides });
  } catch (err) {
    const message = err instanceof Error ? err.message : "낱장을 불러오지 못했습니다";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
