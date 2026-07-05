import { createReportSender, type ResendClientLike } from "@/lib/email/sendReport";

function fakeClient() {
  const calls: Array<Record<string, unknown>> = [];
  const client: ResendClientLike = {
    emails: {
      send: async (args) => {
        calls.push(args);
        return { data: { id: "email_1" }, error: null };
      },
    },
  };
  return { client, calls };
}

test("발신·수신 주소가 없으면 생성 시점에 에러", () => {
  expect(() => createReportSender({ apiKey: "re_x", from: "", to: "b@x.com" })).toThrow();
  expect(() => createReportSender({ apiKey: "re_x", from: "a@x.com", to: "" })).toThrow();
});

test("정상 설정이면 client.emails.send를 올바른 인자로 호출", async () => {
  const { client, calls } = fakeClient();
  const send = createReportSender({
    from: "report@d.one",
    to: "team@d.one",
    client,
  });
  await send({ subject: "일일 리포트", html: "<p>hi</p>" });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    from: "report@d.one",
    to: "team@d.one",
    subject: "일일 리포트",
    html: "<p>hi</p>",
  });
});

test("여러 수신자를 콤마로 구분하면 배열로 전달", async () => {
  const { client, calls } = fakeClient();
  const send = createReportSender({ from: "r@d.one", to: "a@d.one, b@d.one", client });
  await send({ subject: "s", html: "<p>h</p>" });
  expect(calls[0].to).toEqual(["a@d.one", "b@d.one"]);
});

test("Resend가 에러를 반환하면 throw", async () => {
  const client: ResendClientLike = {
    emails: {
      send: async () => ({ data: null, error: { message: "domain not verified" } }),
    },
  };
  const send = createReportSender({ from: "r@d.one", to: "t@d.one", client });
  await expect(send({ subject: "s", html: "<p>h</p>" })).rejects.toThrow("domain not verified");
});
