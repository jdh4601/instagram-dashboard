import { NextResponse } from "next/server";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { invalidBody } from "@/lib/api/validation";
import { SaveStoryFormatRequestSchema, type SavedStoryFormat } from "@/lib/schemas";
import { getRepository, getSavedStoryFormatRepository } from "@/lib/store";
import { reelTitle } from "@/lib/ui/reelTitle";

/** 저장한 스토리텔링 포맷 전부. 유형별 묶음은 화면이 만든다. */
export async function GET() {
  const storyFormats = await getSavedStoryFormatRepository().list();
  return NextResponse.json({ storyFormats });
}

/** 릴스 썸네일·원본 링크는 <img src>·<a href>로 그대로 걸리므로 스킴을 좁힌다. */
function httpOnly(url: string | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

/**
 * 릴스 하나의 포맷 판정을 저장소에 담는다.
 *
 * 본문으로 받는 건 릴스 id뿐이다 — 판정 내용은 저장된 분석에서 직접 읽어야 화면에
 * 보이던 것과 저장된 것이 같고, 지어낸 비트가 저장소로 들어오지 않는다.
 */
export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = SaveStoryFormatRequestSchema.safeParse(body.value);
  if (!parsed.success) return invalidBody(parsed.error);

  const reel = await getRepository().get(parsed.data.reelId);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  const story = reel.reelAnalysis?.story;
  if (!story) {
    return NextResponse.json(
      { error: "아직 분석하지 않은 릴스입니다. 분석을 먼저 돌려 주세요." },
      { status: 400 },
    );
  }

  // 릴스 id를 그대로 저장 id로 쓴다. 같은 릴스를 두 번 담아도 사례가 둘로 갈리지
  // 않고, 다시 분석한 뒤 저장하면 최신 판정으로 덮인다. 처음 담은 시각은 보관
  // 순서의 기준이라 갱신에서 지킨다.
  const repo = getSavedStoryFormatRepository();
  const existing = await repo.get(reel.id);
  const now = new Date().toISOString();
  const saved: SavedStoryFormat = {
    id: reel.id,
    story,
    source: {
      reelId: reel.id,
      title: reelTitle(reel),
      postedAt: reel.postedAt,
      permalink: httpOnly(reel.permalink),
      thumbnailUrl: httpOnly(reel.thumbnailUrl),
      views: reel.views,
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  return NextResponse.json(
    { storyFormat: await repo.upsert(saved) },
    { status: existing ? 200 : 201 },
  );
}
