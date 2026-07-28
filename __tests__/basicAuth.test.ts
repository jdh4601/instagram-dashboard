import { checkBasicAuth } from "@/lib/auth/basicAuth";

const ENDPOINT = "http://localhost:3000/";

function reqWithAuth(header?: string): Request {
  const headers: Record<string, string> = {};
  if (header !== undefined) headers.authorization = header;
  return new Request(ENDPOINT, { headers });
}

function basicHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

describe("checkBasicAuth", () => {
  const prevUser = process.env.DASHBOARD_USER;
  const prevPassword = process.env.DASHBOARD_PASSWORD;

  beforeEach(() => {
    process.env.DASHBOARD_USER = "admin";
    process.env.DASHBOARD_PASSWORD = "s3cret";
  });

  afterAll(() => {
    if (prevUser === undefined) delete process.env.DASHBOARD_USER;
    else process.env.DASHBOARD_USER = prevUser;
    if (prevPassword === undefined) delete process.env.DASHBOARD_PASSWORD;
    else process.env.DASHBOARD_PASSWORD = prevPassword;
  });

  test("DASHBOARD_USER/PASSWORD 미설정 시 인증 없이 통과한다", () => {
    delete process.env.DASHBOARD_USER;
    delete process.env.DASHBOARD_PASSWORD;
    expect(checkBasicAuth(reqWithAuth())).toBeNull();
  });

  test("Authorization 헤더가 없으면 401과 WWW-Authenticate를 반환한다", () => {
    const res = checkBasicAuth(reqWithAuth());
    expect(res?.status).toBe(401);
    expect(res?.headers.get("www-authenticate")).toContain("Basic");
  });

  test("올바른 자격증명은 통과한다(null 반환)", () => {
    const res = checkBasicAuth(reqWithAuth(basicHeader("admin", "s3cret")));
    expect(res).toBeNull();
  });

  test("잘못된 비밀번호는 401", () => {
    const res = checkBasicAuth(reqWithAuth(basicHeader("admin", "wrong")));
    expect(res?.status).toBe(401);
  });

  test("잘못된 사용자명은 401", () => {
    const res = checkBasicAuth(reqWithAuth(basicHeader("eve", "s3cret")));
    expect(res?.status).toBe(401);
  });

  test("Basic이 아닌 인증 스킴은 401", () => {
    const res = checkBasicAuth(reqWithAuth("Bearer sometoken"));
    expect(res?.status).toBe(401);
  });

  test("콜론 없는 base64 페이로드는 401", () => {
    const header = `Basic ${Buffer.from("nocolonhere").toString("base64")}`;
    const res = checkBasicAuth(reqWithAuth(header));
    expect(res?.status).toBe(401);
  });
});
