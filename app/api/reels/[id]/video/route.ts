import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { getInstagramClient } from "@/lib/graph";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { assertJsonRequest } from "@/lib/api/guard";
import { parseByteRange, type ByteRange } from "@/lib/media/httpRange";
import { downloadVideoToCache, readCachedVideoStat } from "@/lib/media/videoCache";
import { downloadViaYtdlp } from "@/lib/media/ytdlpFallback";

/**
 * 캐시된 mp4를 상세 페이지의 `<video>`에 흘려보낸다.
 *
 * 경로는 절대 요청에서 받지 않는다. 릴스 id로 저장소를 조회하고, 파일명은 그 id에서
 * 다시 만든다(lib/media/videoCache.ts). 저장된 videoFile은 "캐시가 있다"는 표시일 뿐
 * 파일을 여는 데 쓰지 않는다.
 */

function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Graph가 살아 있는 릴스에도 media_url을 빼고 200을 주는 경우가 있다. 가장 흔한 사유는
 * 저작권 있는 음원·영상이며, 이 경우 재동기화해도 계속 비어 있다. 삭제로 단정하면
 * 멀쩡한 게시물을 찾아 헤매게 되므로 사유를 나열만 한다.
 */
const MEDIA_URL_MISSING =
  "인스타그램이 이 게시물의 영상 주소를 주지 않았습니다. " +
  "저작권 있는 음원·영상이 포함되면 Graph API가 mp4 주소를 빼고 응답합니다(게시물은 그대로 남아 있습니다). " +
  "게시물이 삭제된 경우에도 같습니다.";

function fileStream(path: string, range?: ByteRange): ReadableStream<Uint8Array> {
  const node = range
    ? createReadStream(path, { start: range.start, end: range.end })
    : createReadStream(path);
  return Readable.toWeb(node) as ReadableStream<Uint8Array>;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reel = await getRepository().get(id);
  if (!reel) return notFound("게시물을 찾을 수 없습니다");

  const { dataDir } = resolveRuntimeConfig();
  let cached: Awaited<ReturnType<typeof readCachedVideoStat>>;
  try {
    cached = await readCachedVideoStat(dataDir, id);
  } catch (err) {
    // 파일명으로 쓸 수 없는 id. 조용히 404로 뭉개면 저장소가 오염된 사실을 못 본다.
    const message = err instanceof Error ? err.message : "영상 경로를 만들 수 없습니다";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!cached) {
    return notFound("내려받은 영상이 없습니다. 상세 화면의 '영상 받기'를 눌러 주세요.");
  }

  const parsed = parseByteRange(req.headers.get("range"), cached.size);
  const baseHeaders = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    // 로컬 캐시라 내용이 바뀌지 않는다. 탐색할 때마다 전체를 다시 읽지 않게 해 준다.
    "Cache-Control": "private, max-age=3600",
  };

  if (parsed.kind === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${cached.size}` },
    });
  }

  if (parsed.kind === "range") {
    const { start, end } = parsed.range;
    return new Response(fileStream(cached.path, parsed.range), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${cached.size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new Response(fileStream(cached.path), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(cached.size) },
  });
}

/** 영상 받기: 지금 시점의 media_url을 Graph에 다시 물어 mp4를 캐시에 내려받는다. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const { id } = await params;

  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return notFound("게시물을 찾을 수 없습니다");

  // 토큰 미설정은 사용자가 고칠 수 있는 설정 문제다. 다운로드 실패(502)와 구분한다.
  let client;
  try {
    client = await getInstagramClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Instagram 연결을 확인해 주세요";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!client.getMediaUrl) {
    return NextResponse.json({ error: "이 Graph 클라이언트는 영상 주소를 조회할 수 없습니다" }, { status: 500 });
  }

  try {
    const { dataDir, isLocalRuntime } = resolveRuntimeConfig();
    const mediaUrl = await client.getMediaUrl(id);

    // Graph가 주소를 안 주면 공개 permalink에서 직접 받아 본다. 외부 도구(yt-dlp)에
    // 기대는 경로라 사용자 PC에서만 연다 — 서버리스에서는 매번 실패만 하고 시간을 쓴다.
    if (!mediaUrl) {
      if (!isLocalRuntime || !reel.permalink) return notFound(MEDIA_URL_MISSING);
      try {
        const fallback = await downloadViaYtdlp(dataDir, id, reel.permalink);
        await repo.upsert({ ...reel, videoFile: fallback.fileName });
        return NextResponse.json({ ok: true, ...fallback });
      } catch (err) {
        // 두 사유를 함께 보여준다. 폴백 실패만 보이면 왜 폴백까지 갔는지 알 수 없다.
        const reason = err instanceof Error ? err.message : "공개 주소에서도 받지 못했습니다";
        return notFound(`${MEDIA_URL_MISSING} 공개 주소에서 직접 받는 것도 실패했습니다: ${reason}`);
      }
    }

    const { fileName, bytes } = await downloadVideoToCache(dataDir, id, mediaUrl);
    await repo.upsert({ ...reel, videoFile: fileName });
    return NextResponse.json({ ok: true, fileName, bytes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "영상을 내려받지 못했습니다";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
