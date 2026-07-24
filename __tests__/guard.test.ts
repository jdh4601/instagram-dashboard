import { assertJsonRequest } from "@/lib/api/guard";

const ENDPOINT = "http://localhost:3000/api/settings";
const HOST = "localhost:3000";

function post(headers: Record<string, string> = {}, body?: string): Request {
  return new Request(ENDPOINT, { method: "POST", headers: { host: HOST, ...headers }, body });
}

test("text/plain POST는 415로 거부한다 (CSRF simple request 차단)", () => {
  const res = assertJsonRequest(
    post({ "content-type": "text/plain;charset=UTF-8" }, "csrf payload"),
  );
  expect(res?.status).toBe(415);
});

test("application/jsonp는 JSON처럼 시작해도 415로 거부한다", () => {
  const res = assertJsonRequest(
    post({ "content-type": "application/jsonp" }, "callback({})"),
  );
  expect(res?.status).toBe(415);
});

test("application/json charset 파라미터는 허용한다", () => {
  const res = assertJsonRequest(
    post({ "content-type": "application/json; charset=utf-8" }, "{}"),
  );
  expect(res).toBeNull();
});

test("Origin이 Host와 다륜 JSON POST는 403으로 거부한다", () => {
  const res = assertJsonRequest(
    post({ "content-type": "application/json", origin: "http://evil.example" }, "{}"),
  );
  expect(res?.status).toBe(403);
});

test("Host가 같아도 요청 URL과 Origin의 scheme이 다르면 403으로 거부한다", () => {
  const req = new Request("https://localhost:3000/api/settings", {
    method: "POST",
    headers: {
      host: HOST,
      "content-type": "application/json",
      origin: `http://${HOST}`,
    },
    body: "{}",
  });
  expect(assertJsonRequest(req)?.status).toBe(403);
});

test("서버가 0.0.0.0에 바인딩돼도 브라우저 Host와 Origin이 같으면 통과한다", () => {
  const req = new Request("http://0.0.0.0:3000/api/settings", {
    method: "POST",
    headers: {
      host: HOST,
      "content-type": "application/json",
      origin: `http://${HOST}`,
    },
    body: "{}",
  });
  expect(assertJsonRequest(req)).toBeNull();
});

test("파싱 불가능한 Origin은 403으로 거부한다", () => {
  const res = assertJsonRequest(
    post({ "content-type": "application/json", origin: "not-a-url" }, "{}"),
  );
  expect(res?.status).toBe(403);
});

test("같은 Origin + application/json은 통과한다", () => {
  const res = assertJsonRequest(
    post({ "content-type": "application/json", origin: `http://${HOST}` }, "{}"),
  );
  expect(res).toBeNull();
});

test("Origin 없음 + application/json은 통과한다", () => {
  const res = assertJsonRequest(post({ "content-type": "application/json" }, "{}"));
  expect(res).toBeNull();
});

test("본문 없는 POST(cron curl 스타일)는 Content-Type 없어도 통과한다", () => {
  const res = assertJsonRequest(post({ "x-cron-secret": "s3cret" }));
  expect(res).toBeNull();
});

test("Content-Type 없이 본문만 실린 POST는 415로 거부한다", () => {
  const res = assertJsonRequest(post({ "content-length": "12" }));
  expect(res?.status).toBe(415);
});

test("GET은 가드 대상이 아니므로 항상 통과한다", () => {
  const res = assertJsonRequest(new Request(ENDPOINT, { headers: { host: HOST } }));
  expect(res).toBeNull();
});
