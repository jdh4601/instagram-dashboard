import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { parseSrt } from "@/lib/parsing/srt";

// SRT 자막 업로드: 원문 SRT를 서버에서 파싱해 reel.transcript에 저장.
// 잔존 차트 급락 구간 매칭·자막 분석이 모두 이 데이터를 사용한다.
const MAX_SRT_BYTES = 512 * 1024; // 자막 한 편은 넉넉히 512KB 이내. 과대 페이로드 차단.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다" }, { status: 400 });
  }

  const srt = (body as { srt?: unknown })?.srt;
  if (typeof srt !== "string" || !srt.trim()) {
    return NextResponse.json({ error: "SRT 내용이 비어 있습니다" }, { status: 400 });
  }
  if (Buffer.byteLength(srt, "utf8") > MAX_SRT_BYTES) {
    return NextResponse.json({ error: "SRT 파일이 너무 큽니다 (최대 512KB)" }, { status: 413 });
  }

  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  const transcript = parseSrt(srt);
  if (transcript.length === 0) {
    return NextResponse.json(
      { error: "자막을 인식하지 못했습니다. CapCut에서 내보낸 .srt 파일인지 확인해 주세요." },
      { status: 422 },
    );
  }

  await repo.upsert({ ...reel, transcript });
  return NextResponse.json({ ok: true, lineCount: transcript.length });
}

// 자막 삭제
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  const { transcript: _drop, ...rest } = reel;
  void _drop;
  await repo.upsert(rest);
  return NextResponse.json({ ok: true });
}
