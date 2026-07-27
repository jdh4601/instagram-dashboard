// 과거 스냅샷의 누락된 계정 지표를 Graph에서 다시 받아 채운다.
//
// 왜 필요한가: follows_and_unfollows를 breakdown 없이 요청하던 버그(INS-13) 때문에
// 팔로우·언팔로우가 전 기간 비어 있었고, profile_views·website_clicks는 아예
// 수집하지 않았다. 그 결과 전환율 증감이 계산되지 않고, 상단 KPI의 팔로우 전환율은
// API 실측값과 팔로워 증분 추정치를 뒤섞어 빼고 있었다.
//
// 안전 규칙:
//   - 기본은 드라이런. --apply를 줘야 파일을 쓴다.
//   - 이미 값이 있는 필드는 절대 덮어쓰지 않는다. 빈 칸만 채운다.
//   - 쓰기 전에 타임스탬프 백업을 남긴다.
//   - 읽기 전용 GET만 보낸다. 출력에서 토큰과 계정 ID는 마스킹한다.
//
//   node scripts/backfill-account-insights.mjs            # 드라이런
//   node scripts/backfill-account-insights.mjs --apply    # 실제 기록
import { readFile, writeFile, copyFile } from "node:fs/promises";

const VERSION = "v23.0";
const BASE = "https://graph.instagram.com";
const WINDOW_DAYS = 7; // sync.ts와 같은 규약: since = date - 7일, until = date
const REQUEST_GAP_MS = 250;

const SNAPSHOTS_URL = new URL("../data/snapshots.json", import.meta.url);
const SETTINGS_URL = new URL("../data/settings.json", import.meta.url);

// 묶음 요청용 계정 지표. client.ts의 ACCOUNT_METRICS와 같은 목록이다.
const BASE_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "profile_views",
  "website_clicks",
  "profile_links_taps",
];
// follow_type breakdown을 공유하는 지표.
const FOLLOW_TYPE_METRICS = ["reach", "follows_and_unfollows"];

// Graph 지표명 → 스냅샷 필드명. reachLast7d와 followerCount는 건드리지 않는다.
// 이미 기록된 값이고, 덮어쓰면 기존 시계열이 조용히 움직인다.
const FIELD_BY_METRIC = {
  views: "viewsLast7d",
  accounts_engaged: "accountsEngagedLast7d",
  total_interactions: "totalInteractionsLast7d",
  profile_views: "profileViewsLast7d",
  website_clicks: "websiteClicksLast7d",
  profile_links_taps: "profileLinksTapsLast7d",
  follows: "followsLast7d",
  unfollows: "unfollowsLast7d",
  reach_follower: "followerReachLast7d",
  reach_non_follower: "nonFollowerReachLast7d",
};

let activeToken = "";
function mask(text) {
  let out = String(text);
  if (activeToken) out = out.split(activeToken).join("<TOKEN>");
  return out.replace(/\b\d{15,}\b/g, "<ID>");
}

async function loadToken() {
  if (process.env.INSTAGRAM_ACCESS_TOKEN) return process.env.INSTAGRAM_ACCESS_TOKEN;
  try {
    const raw = await readFile(SETTINGS_URL, "utf8");
    return JSON.parse(raw)?.instagram?.accessToken ?? null;
  } catch {
    return null;
  }
}

function daysBefore(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

// map.ts의 flattenInsights와 같은 규칙. NON_FOLLOWER에도 "follower"가 들어 있어
// 검사 순서가 중요하다 — 여기서 틀리면 언팔 수가 팔로우를 덮어쓴다.
function flattenInsights(json) {
  const out = {};
  for (const item of json?.data ?? []) {
    const value = item.values?.[0]?.value ?? item.total_value?.value;
    if (typeof value === "number") out[item.name] = value;

    for (const breakdown of item.total_value?.breakdowns ?? []) {
      for (const result of breakdown.results ?? []) {
        if (typeof result.value !== "number") continue;
        const label = (result.dimension_values ?? []).join(" ").toLowerCase();
        if (item.name === "follows_and_unfollows") {
          if (label.includes("non_follower")) out.unfollows = result.value;
          else if (label.includes("follower")) out.follows = result.value;
        } else if (item.name === "reach") {
          if (label.includes("non_follower")) out.reach_non_follower = result.value;
          else if (label.includes("follower")) out.reach_follower = result.value;
        }
      }
    }
  }
  return out;
}

async function request(params) {
  const query = new URLSearchParams({ ...params, access_token: activeToken });
  // 주의: Graph 규약대로 토큰을 쿼리스트링에 싣는다. 이 URL을 그대로 로깅하지 말 것.
  const res = await fetch(`${BASE}/${VERSION}/me/insights?${query.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(mask(json?.error?.message ?? `Graph 오류 (${res.status})`));
  }
  return json;
}

async function fetchWindow(since, until) {
  const window = { period: "day", metric_type: "total_value", since, until };
  const metrics = {};
  const failures = [];

  try {
    Object.assign(metrics, flattenInsights(await request({ ...window, metric: BASE_METRICS.join(",") })));
  } catch (err) {
    failures.push(`base: ${err.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
  try {
    Object.assign(
      metrics,
      flattenInsights(await request({ ...window, metric: FOLLOW_TYPE_METRICS.join(","), breakdown: "follow_type" })),
    );
  } catch (err) {
    failures.push(`breakdown: ${err.message}`);
  }
  return { metrics, failures };
}

function missingFields(snapshot) {
  return Object.entries(FIELD_BY_METRIC)
    .filter(([, field]) => typeof snapshot[field] !== "number")
    .map(([metric, field]) => ({ metric, field }));
}

function applyMetrics(snapshot, metrics, gaps) {
  const filled = {};
  for (const { metric, field } of gaps) {
    if (typeof metrics[metric] === "number") filled[field] = metrics[metric];
  }
  if (Object.keys(filled).length === 0) return null;

  const next = { ...snapshot, ...filled };

  // 진단 목록도 현실에 맞춘다. 안 그러면 "미지원"으로 남아 화면이 값과 어긋난다.
  const nowAvailable = new Set(next.availableMetrics ?? []);
  const stillUnavailable = new Set(next.unavailableMetrics ?? []);
  if ("followsLast7d" in filled || "unfollowsLast7d" in filled) {
    nowAvailable.add("follows_and_unfollows");
    stillUnavailable.delete("follows_and_unfollows");
  }
  if ("followerReachLast7d" in filled || "nonFollowerReachLast7d" in filled) {
    nowAvailable.add("reach_follow_type");
    stillUnavailable.delete("reach_follow_type");
  }
  for (const metric of ["profile_views", "website_clicks", "views", "accounts_engaged", "total_interactions", "profile_links_taps"]) {
    if (FIELD_BY_METRIC[metric] in filled) {
      nowAvailable.add(metric);
      stillUnavailable.delete(metric);
    }
  }
  next.availableMetrics = [...nowAvailable].sort();
  next.unavailableMetrics = [...stillUnavailable].sort();

  return { next, filled };
}

async function main() {
  const apply = process.argv.includes("--apply");

  activeToken = await loadToken();
  if (!activeToken) {
    console.error("액세스 토큰을 찾지 못했습니다 (INSTAGRAM_ACCESS_TOKEN 또는 data/settings.json).");
    process.exit(1);
  }

  const snapshots = JSON.parse(await readFile(SNAPSHOTS_URL, "utf8"));
  console.log(`스냅샷 ${snapshots.length}개 · 모드: ${apply ? "APPLY (파일 기록)" : "DRY RUN (기록 없음)"}\n`);

  const updated = [];
  let changedCount = 0;
  const problems = [];

  for (const snapshot of snapshots) {
    const gaps = missingFields(snapshot);
    if (gaps.length === 0) {
      updated.push(snapshot);
      console.log(`${snapshot.date}  빈 칸 없음 — 건너뜀`);
      continue;
    }

    const since = daysBefore(snapshot.date, WINDOW_DAYS);
    const { metrics, failures } = await fetchWindow(since, snapshot.date);
    failures.forEach((failure) => problems.push(`${snapshot.date} ${failure}`));

    const result = applyMetrics(snapshot, metrics, gaps);
    if (result === null) {
      updated.push(snapshot);
      console.log(`${snapshot.date}  응답에 채울 값 없음 (빈 칸 ${gaps.length}개 유지)`);
      continue;
    }

    updated.push(result.next);
    changedCount += 1;
    const summary = Object.entries(result.filled)
      .map(([field, value]) => `${field}=${value}`)
      .join("  ");
    console.log(`${snapshot.date}  ${since}~${snapshot.date}  ${summary}`);
    await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
  }

  console.log(`\n채운 스냅샷: ${changedCount}/${snapshots.length}`);
  if (problems.length > 0) {
    console.log("\n실패한 요청:");
    problems.forEach((problem) => console.log(`  - ${problem}`));
  }

  if (!apply) {
    console.log("\n드라이런이라 파일을 쓰지 않았습니다. 반영하려면 --apply를 붙이세요.");
    return;
  }
  if (changedCount === 0) {
    console.log("\n변경 사항이 없어 파일을 쓰지 않았습니다.");
    return;
  }

  const backup = new URL(`../data/snapshots.backup-${Date.now()}.json`, import.meta.url);
  await copyFile(SNAPSHOTS_URL, backup);
  await writeFile(SNAPSHOTS_URL, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`\n백업: ${backup.pathname.split("/").pop()}`);
  console.log("data/snapshots.json 갱신 완료.");
}

main().catch((err) => {
  console.error(mask(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
