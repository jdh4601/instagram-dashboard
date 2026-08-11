import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { getInstagramClient } from "@/lib/graph";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { assertJsonRequest } from "@/lib/api/guard";
import { parseByteRange, type ByteRange } from "@/lib/media/httpRange";
import { downloadVideoToCache, readCachedVideoStat } from "@/lib/media/videoCache";

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
    const mediaUrl = await client.getMediaUrl(id);
    if (!mediaUrl) {
      return notFound("인스타그램이 이 게시물의 영상 주소를 주지 않았습니다. 삭제됐거나 영상이 아닐 수 있어요.");
    }
    const { dataDir } = resolveRuntimeConfig();
    const { fileName, bytes } = await downloadVideoToCache(dataDir, id, mediaUrl);
    await repo.upsert({ ...reel, videoFile: fileName });
    return NextResponse.json({ ok: true, fileName, bytes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "영상을 내려받지 못했습니다";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
