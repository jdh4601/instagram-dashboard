import { analyzeReel } from "@/lib/analysis/analyze";
import type { Reel } from "@/lib/schemas";

const reel: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 5, saves: 20, shares: 30,
  avgWatchTimeSec: 20, hookRetention3s: 35,
  transcript: [{ startSec: 3, endSec: 9, text: "늘어지는 설명" }],
};

test("analyzeReel은 진단/처방을 합성한다", () => {
  const out = analyzeReel(reel, []);
  expect(out.diagnosis.bottleneck?.key).toBe("hookRetention3s");
  expect(out.prescriptions.some((p) => p.metric === "hookRetention3s")).toBe(true);
  expect(out.baselineActive).toBe(false); // history 부족
});
