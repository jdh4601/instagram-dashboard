import { generateAndSendDailyReport } from "@/lib/report/generateAndSendDailyReport";
import type { Reel, AccountSnapshot } from "@/lib/schemas";

function reel(p: Partial<Reel> & { id: string }): Reel {
  return {
    postedAt: "2026-06-01T00:00:00+0000",
    durationSec: 0,
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 0,
    ...p,
  };
}

const reels: Reel[] = [reel({ id: "a", views: 9000, reach: 8000, likes: 400 })];
const snapshots: AccountSnapshot[] = [
  { date: "2026-07-04", followerCount: 240, reachLast7d: 1000 },
  { date: "2026-07-05", followerCount: 252, reachLast7d: 1500 },
];

interface SentEmail {
  subject: string;
  html: string;
}

function makeDeps(overrides: Partial<Parameters<typeof generateAndSendDailyReport>[0]> = {}) {
  const calls = { sync: 0 };
  const sent: SentEmail[] = [];
  const deps = {
    sync: async () => {
      calls.sync += 1;
    },
    loadReels: async () => reels,
    loadSnapshots: async () => snapshots,
    send: async (email: SentEmail) => {
      sent.push(email);
    },
    today: () => "2026-07-05",
    ...overrides,
  };
  return { deps, calls, sent };
}

test("Graph 동기화를 먼저 실행한다", async () => {
  const { deps, calls } = makeDeps();
  await generateAndSendDailyReport(deps);
  expect(calls.sync).toBe(1);
});

test("리포트 HTML을 담아 이메일을 1회 발송한다", async () => {
  const { deps, sent } = makeDeps();
  await generateAndSendDailyReport(deps);
  expect(sent).toHaveLength(1);
  expect(sent[0].html).toContain("252");
});

test("제목에 날짜와 팔로워 수를 포함한다", async () => {
  const { deps, sent } = makeDeps();
  await generateAndSendDailyReport(deps);
  expect(sent[0].subject).toContain("2026-07-05");
  expect(sent[0].subject).toContain("252");
});

test("생성된 리포트를 반환한다", async () => {
  const { deps } = makeDeps();
  const report = await generateAndSendDailyReport(deps);
  expect(report.date).toBe("2026-07-05");
  expect(report.metrics.followerCount).toBe(252);
});

test("동기화 실패 시 이메일을 보내지 않고 에러를 전파한다", async () => {
  const { deps, sent } = makeDeps({
    sync: async () => {
      throw new Error("graph down");
    },
  });
  await expect(generateAndSendDailyReport(deps)).rejects.toThrow("graph down");
  expect(sent).toHaveLength(0);
});
