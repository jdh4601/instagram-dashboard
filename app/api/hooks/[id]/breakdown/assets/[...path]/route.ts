import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getHookRepository } from "@/lib/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { parseByteRange, type ByteRange } from "@/lib/media/httpRange";
import { reelBreakdownAssetPath } from "@/lib/reelBreakdown/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileStream(path: string, range?: ByteRange): ReadableStream<Uint8Array> {
  const node = range
    ? createReadStream(path, { start: range.start, end: range.end })
    : createReadStream(path);
  return Readable.toWeb(node) as ReadableStream<Uint8Array>;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
): Promise<Response> {
  const { id, path: parts } = await params;
  const hook = await getHookRepository().get(id);
  if (!hook?.breakdown) {
    return NextResponse.json({ error: "해체 결과를 찾을 수 없습니다" }, { status: 404 });
  }

  const relative = parts.join("/");
  const referenced = new Set(
    hook.breakdown.beats.flatMap((beat) => [
      `frames/${beat.posterFile}`,
      `clips/${beat.clipFile}`,
    ]),
  );
  if (!referenced.has(relative)) {
    return NextResponse.json({ error: "해체 결과에 없는 파일입니다" }, { status: 404 });
  }

  let file: string;
  try {
    file = reelBreakdownAssetPath(
      resolveRuntimeConfig().dataDir,
      hook.breakdown.assetKey,
      relative,
    );
  } catch {
    return NextResponse.json({ error: "해체 파일 경로가 올바르지 않습니다" }, { status: 400 });
  }

  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    size = info.size;
  } catch {
    return NextResponse.json({ error: "해체 파일을 찾을 수 없습니다" }, { status: 404 });
  }

  const isVideo = relative.endsWith(".mp4");
  const baseHeaders = {
    "Content-Type": isVideo ? "video/mp4" : "image/jpeg",
    "Cache-Control": "private, max-age=3600",
    ...(isVideo ? { "Accept-Ranges": "bytes" } : {}),
  };
  if (!isVideo) {
    return new Response(fileStream(file), {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(size) },
    });
  }

  const parsed = parseByteRange(req.headers.get("range"), size);
  if (parsed.kind === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${size}` },
    });
  }
  if (parsed.kind === "range") {
    const { start, end } = parsed.range;
    return new Response(fileStream(file, parsed.range), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(fileStream(file), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
