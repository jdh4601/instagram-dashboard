import { NextResponse } from "next/server";
import { assertJsonRequest } from "@/lib/api/guard";
import { fetchInstagramPreview, isInstagramPostUrl } from "@/lib/instagram/preview";

// 훅을 담을 때 링크만 붙여 넣으면 썸네일과 계정을 대신 채워 준다.
// 손으로 옮겨 적던 값이라, 비어 있는 채로 쌓인 훅이 대부분이었다.
export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const url = body && typeof body.url === "string" ? body.url.trim() : "";

  // 서버가 이 주소로 직접 요청을 보낸다. 임의의 호스트를 허용하면 내부망을
  // 두드리는 통로가 된다.
  if (!isInstagramPostUrl(url)) {
    return NextResponse.json(
      { error: "인스타그램 게시물 주소(reel 또는 p)만 넣을 수 있습니다" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await fetchInstagramPreview(url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "게시물 정보를 읽지 못했습니다";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
