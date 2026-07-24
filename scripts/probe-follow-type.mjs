// INS-8 spike: 계정/게시물 도달에 follow_type breakdown이 붙는지 실제 응답으로 확인한다.
// 읽기 전용 GET만 보낸다. 출력에서 토큰과 계정 ID는 마스킹한다.
//
//   node scripts/probe-follow-type.mjs
import { readFile } from "node:fs/promises";

const VERSION = "v23.0";
const BASE = "https://graph.instagram.com";

let activeToken = "";
function mask(text) {
  let out = String(text);
  if (activeToken) out = out.split(activeToken).join("<TOKEN>");
  return out.replace(/\b\d{15,}\b/g, "<ID>");
}

// 앱과 같은 출처를 쓴다: 환경변수 우선, 없으면 data/settings.json의 instagram.accessToken.
async function loadToken() {
  if (process.env.INSTAGRAM_ACCESS_TOKEN) return process.env.INSTAGRAM_ACCESS_TOKEN;
  try {
    const raw = await readFile(new URL("../data/settings.json", import.meta.url), "utf8");
    return JSON.parse(raw)?.instagram?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function probe(label, path, params) {
  const url = new URL(`${BASE}/${VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  process.stdout.write(`\n## ${label}\n`);
  process.stdout.write(`GET ${mask(url.toString())}\n`);
  try {
    const res = await fetch(url);
    const body = await res.text();
    process.stdout.write(`status ${res.status}\n${mask(body).slice(0, 1500)}\n`);
  } catch (err) {
    process.stdout.write(`요청 실패: ${mask(err instanceof Error ? err.message : String(err))}\n`);
  }
}

const token = await loadToken();
if (!token) {
  console.error("Instagram 토큰을 찾지 못했습니다 (환경변수 또는 data/settings.json).");
  process.exit(1);
}
activeToken = token;

// 1) 계정 레벨 reach + follow_type breakdown
await probe("계정 reach breakdown=follow_type", "me/insights", {
  metric: "reach",
  metric_type: "total_value",
  breakdown: "follow_type",
  period: "day",
  access_token: token,
});

// 2) 비교용: breakdown 없는 계정 reach (기준선)
await probe("계정 reach (breakdown 없음)", "me/insights", {
  metric: "reach",
  metric_type: "total_value",
  period: "day",
  access_token: token,
});

// 3) 게시물 레벨에도 붙는지 — 최근 미디어 1건으로 확인
const mediaUrl = new URL(`${BASE}/${VERSION}/me/media`);
mediaUrl.searchParams.set("fields", "id,media_product_type");
mediaUrl.searchParams.set("limit", "1");
mediaUrl.searchParams.set("access_token", token);
const mediaRes = await fetch(mediaUrl);
const media = await mediaRes.json();
const mediaId = media?.data?.[0]?.id;

if (!mediaId) {
  process.stdout.write("\n## 게시물 레벨\n미디어를 찾지 못해 건너뜁니다\n");
} else {
  await probe("게시물 reach breakdown=follow_type", `${mediaId}/insights`, {
    metric: "reach",
    breakdown: "follow_type",
    access_token: token,
  });
}
