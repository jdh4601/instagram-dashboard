import type { Reel, ScreenshotParse } from "@/lib/schemas";

// 스크린샷 파싱 결과를 릴스에 병합.
// 파싱에 없는 필드는 기존 값을 보존하고, 집계 지표는 건드리지 않는다.
// skipRate가 주어지면 3초 후 잔존율 = 100 - skipRate 로 환산한다.
export function mergeScreenshotParse(reel: Reel, parse: ScreenshotParse): Reel {
  const hookFromSkip = parse.skipRate != null ? 100 - parse.skipRate : undefined;
  return {
    ...reel,
    hookRetention3s: parse.hookRetention3s ?? hookFromSkip ?? reel.hookRetention3s,
    skipRate: parse.skipRate ?? reel.skipRate,
    skipRateSource: parse.skipRate !== undefined ? "EDIT" : reel.skipRateSource,
    retentionCurve: parse.retentionCurve ?? reel.retentionCurve,
    reachSources: parse.reachSources ?? reel.reachSources,
    audienceBreakdown: parse.audienceBreakdown ?? reel.audienceBreakdown,
    watchTimeBuckets: parse.watchTimeBuckets ?? reel.watchTimeBuckets,
    profileVisits: parse.profileVisits ?? reel.profileVisits,
  };
}
