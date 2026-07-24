// NDJSON(줄바꿈으로 구분된 JSON) 스트림을 이벤트 단위로 읽는다.
//
// 네트워크 청크 경계는 줄 경계와 무관하므로 버퍼에 모았다가 개행을 만날 때만
// 파싱한다. TextDecoder의 stream 옵션은 멀티바이트 문자가 청크 경계에서 잘린
// 경우를 이어붙여 준다.
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      for (let newline = buffer.indexOf("\n"); newline !== -1; newline = buffer.indexOf("\n")) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line !== "") yield JSON.parse(line);
      }
    }
    // 서버가 마지막 줄에 개행을 붙이지 않고 끊는 경우를 위한 처리.
    const rest = buffer.trim();
    if (rest !== "") yield JSON.parse(rest);
  } finally {
    reader.releaseLock();
  }
}
