import { readNdjson } from "@/lib/ui/ndjsonStream";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(chunks: string[]): Promise<unknown[]> {
  const events: unknown[] = [];
  for await (const event of readNdjson(streamOf(chunks))) events.push(event);
  return events;
}

test("한 청크에 담긴 여러 줄을 각각 파싱한다", async () => {
  const events = await collect(['{"n":1}\n{"n":2}\n']);
  expect(events).toEqual([{ n: 1 }, { n: 2 }]);
});

// 네트워크 청크 경계는 줄 경계와 무관하다. 버퍼링하지 않으면 JSON.parse가 깨진다.
test("한 줄이 청크 경계로 쪼개져도 이어붙여 파싱한다", async () => {
  const events = await collect(['{"type":"prog', 'ress","completed":12}', "\n"]);
  expect(events).toEqual([{ type: "progress", completed: 12 }]);
});

test("마지막 줄에 개행이 없어도 파싱한다", async () => {
  const events = await collect(['{"n":1}\n{"n":2}']);
  expect(events).toEqual([{ n: 1 }, { n: 2 }]);
});

test("빈 줄은 건너뛴다", async () => {
  const events = await collect(['{"n":1}\n\n\n{"n":2}\n']);
  expect(events).toEqual([{ n: 1 }, { n: 2 }]);
});

test("한글이 청크 경계에서 잘려도 복원한다", async () => {
  const encoded = new TextEncoder().encode('{"m":"동기화"}\n');
  const events: unknown[] = [];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded.slice(0, 9));
      controller.enqueue(encoded.slice(9));
      controller.close();
    },
  });
  for await (const event of readNdjson(stream)) events.push(event);
  expect(events).toEqual([{ m: "동기화" }]);
});
