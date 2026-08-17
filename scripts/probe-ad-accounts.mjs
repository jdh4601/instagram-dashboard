#!/usr/bin/env node
/**
 * 어느 광고 계정에 우리 게시물의 광고가 쌓이는지 찾는다.
 *
 * 인스타그램 앱 '홍보하기'로 만든 부스트는 메인 Ads Manager 계정이 아니라 페이지에
 * 딸린 별도 광고 계정에 들어가는 일이 잦다. 계정 id를 잘못 넣으면 자격증명이 멀쩡한데도
 * 광고 효율 표가 영영 비어서, 원인을 되짚기가 어렵다. 그 갈림길을 여기서 한 번에 가른다.
 *
 * 사용법:
 *   META_ADS_TOKEN=<Facebook 사용자 토큰> node scripts/probe-ad-accounts.mjs
 *   node scripts/probe-ad-accounts.mjs --token=<토큰> --days=180
 *
 * 토큰은 Graph API Explorer에서 ads_read + instagram_basic + pages_show_list 권한으로
 * 발급합니다. 인스타그램 로그인 토큰(IGAA...)은 여기 쓸 수 없습니다 — Marketing API는
 * 페이스북 사용자 토큰만 받습니다.
 */
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

const BASE = "https://graph.facebook.com";
const VERSION = "v23.0";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const args = process.argv.slice(2);

function argValue(name) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const token = (argValue("token") ?? process.env.META_ADS_TOKEN ?? "").trim();
const lookbackDays = Number.parseInt(argValue("days") ?? "180", 10);

if (!token) {
  console.error(
    "액세스 토큰이 없습니다.\n" +
      "  META_ADS_TOKEN=<토큰> node scripts/probe-ad-accounts.mjs\n" +
      "  토큰은 https://developers.facebook.com/tools/explorer 에서 ads_read 권한으로 발급합니다.",
  );
  process.exit(1);
}
if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
  console.error("--days 는 1 이상의 숫자여야 합니다.");
  process.exit(1);
}
if (token.startsWith("IGA")) {
  console.error(
    "인스타그램 로그인 토큰(IGAA...)으로 보입니다. Marketing API는 이 토큰을 받지 않습니다.\n" +
      "Graph API Explorer에서 '페이스북 사용자 토큰'을 ads_read 권한으로 새로 발급하세요.",
  );
  process.exit(1);
}

/** 오류 문구에 토큰이 섞여 나가지 않도록 지운다. */
function redact(message) {
  return String(message)
    .replaceAll(token, "[REDACTED]")
    .replaceAll(encodeURIComponent(token), "[REDACTED]");
}

async function request(path, params = {}) {
  // Graph 규약대로 토큰을 쿼리스트링에 싣는다. 이 URL 전체를 로깅하지 말 것.
  const query = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${BASE}/${VERSION}/${path}?${query}`);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = json?.error ?? {};
    const err = new Error(redact(error.message ?? `Graph 오류 (${path})`));
    err.code = error.code;
    throw err;
  }
  return json;
}

/** paging.cursors.after를 따라가며 data를 모은다. */
async function collect(path, params = {}) {
  const rows = [];
  let after;
  for (let page = 0; page < MAX_PAGES; page++) {
    const json = await request(path, {
      ...params,
      limit: String(PAGE_SIZE),
      ...(after ? { after } : {}),
    });
    const data = json?.data ?? [];
    rows.push(...data);
    after = json?.paging?.cursors?.after;
    if (!after || data.length === 0) break;
  }
  return rows;
}

function isoDaysAgo(days) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function won(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

// --- 저장된 게시물 id 읽기 -------------------------------------------------

const rawDataDir = process.env.DATA_DIR?.trim() || "data";
const dataDir = isAbsolute(rawDataDir) ? rawDataDir : resolve(process.cwd(), rawDataDir);
const reelsPath = resolve(dataDir, "reels.json");

let storedIds;
try {
  const reels = JSON.parse(await readFile(reelsPath, "utf8"));
  storedIds = new Set(reels.map((reel) => reel.id));
} catch (err) {
  console.error(`저장된 게시물을 읽지 못했습니다 (${reelsPath}): ${err.message}`);
  console.error("동기화를 먼저 한 번 돌린 뒤 다시 실행하세요.");
  process.exit(1);
}
if (storedIds.size === 0) {
  console.error("저장된 게시물이 없습니다. 동기화를 먼저 돌리세요.");
  process.exit(1);
}

const range = { since: isoDaysAgo(lookbackDays), until: isoDaysAgo(0) };
console.log(`저장된 게시물 ${storedIds.size}건 / 조회 기간 ${range.since} ~ ${range.until}\n`);

// --- 토큰에 실제로 박힌 권한 ------------------------------------------------

// Graph API Explorer는 Permissions 목록에 이름을 추가해도 'Generate Access Token'을
// 다시 누르기 전까지 토큰에 부여하지 않는다. 화면에는 ads_read가 보이는데 토큰에는
// 없는 상태가 만들어져, 여기서 먼저 짚지 않으면 원인을 엉뚱한 데서 찾게 된다.
try {
  const granted = new Set(
    (await collect("me/permissions"))
      .filter((row) => row.status === "granted")
      .map((row) => row.permission),
  );
  if (!granted.has("ads_read")) {
    console.error("이 토큰에는 ads_read 권한이 없습니다.");
    console.error(`  토큰이 가진 권한: ${[...granted].sort().join(", ") || "(없음)"}`);
    console.error(
      "\n→ Graph API Explorer에서 Permissions에 ads_read를 추가한 뒤,\n" +
        "  반드시 'Generate Access Token'을 다시 눌러 새 토큰을 받으세요.\n" +
        "  목록에 추가만 해서는 토큰에 부여되지 않습니다.",
    );
    process.exit(1);
  }
  console.log(`토큰 권한 확인 — ads_read ✅ (전체: ${[...granted].sort().join(", ")})\n`);
} catch (err) {
  // 권한 확인이 막혀도 본 조회는 시도해 본다 — 실패 원인은 아래에서 다시 잡힌다.
  console.warn(`권한 목록을 읽지 못했습니다(계속 진행): ${err.message}\n`);
}

// --- 광고 계정 목록 --------------------------------------------------------

let accounts;
try {
  accounts = await collect("me/adaccounts", { fields: "id,name,currency,account_status" });
} catch (err) {
  console.error(`광고 계정 목록을 읽지 못했습니다: ${err.message}`);
  if (err.code === 190) console.error("→ 토큰이 만료되었거나 잘못되었습니다.");
  if (err.code === 200 || err.code === 100) console.error("→ 토큰에 ads_read 권한이 없습니다.");
  process.exit(1);
}

// me/adaccounts는 '내가 직접 배정된' 계정만 준다. 비즈니스가 소유한 계정은 여기
// 안 나오는 일이 있어, 비어 보일 때 비즈니스 쪽도 한 번 더 훑는다.
if (accounts.length === 0) {
  console.log("me/adaccounts가 비었습니다. 비즈니스 소유 계정을 확인합니다…");
  try {
    const businesses = await collect("me/businesses", { fields: "id,name" });
    for (const business of businesses) {
      for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
        try {
          const owned = await collect(`${business.id}/${edge}`, {
            fields: "id,name,currency,account_status",
          });
          accounts.push(...owned);
        } catch {
          // 이 엣지에 권한이 없을 뿐이다. 다른 경로가 남아 있으므로 계속 간다.
        }
      }
    }
    // 두 경로가 같은 계정을 줄 수 있어 id로 중복을 없앤다.
    accounts = [...new Map(accounts.map((account) => [account.id, account])).values()];
    console.log(`비즈니스 ${businesses.length}곳에서 광고 계정 ${accounts.length}개를 찾았습니다.`);
  } catch (err) {
    console.log(`비즈니스 목록을 읽지 못했습니다: ${err.message}`);
  }
}

if (accounts.length === 0) {
  console.error("\n이 토큰으로 볼 수 있는 광고 계정이 없습니다.");
  console.error(
    "→ 인스타그램만으로 만든 광고 계정이면 Marketing API에 올라오지 않습니다.\n" +
      "  이 경우 자동 집계 경로가 없어 수동 입력이 유일한 방법입니다.",
  );
  process.exit(2);
}

console.log(`광고 계정 ${accounts.length}개를 찾았습니다.\n`);

// --- 계정별로 게시물 매칭 --------------------------------------------------

const findings = [];

for (const account of accounts) {
  const label = `${account.id}${account.name ? ` (${account.name})` : ""}`;
  process.stdout.write(`· ${label} … `);

  let ads;
  try {
    ads = await collect(`${account.id}/ads`, {
      fields: "id,effective_status,creative{effective_instagram_media_id}",
    });
  } catch (err) {
    console.log(`읽지 못함 — ${err.message}`);
    continue;
  }

  // 인스타 게시물에 붙은 광고만 셈한다. 페이스북 전용 소재는 조인할 키가 없다.
  const linked = ads.filter((ad) => ad.creative?.effective_instagram_media_id);
  const matched = linked.filter((ad) =>
    storedIds.has(ad.creative.effective_instagram_media_id),
  );
  const matchedMedia = new Set(
    matched.map((ad) => ad.creative.effective_instagram_media_id),
  );

  if (matched.length === 0) {
    console.log(`광고 ${ads.length}건 / 인스타 연결 ${linked.length}건 / 우리 게시물 0건`);
    continue;
  }

  let spend = 0;
  let reach = 0;
  try {
    const insights = await collect(`${account.id}/insights`, {
      level: "ad",
      fields: "ad_id,spend,reach",
      time_range: JSON.stringify(range),
    });
    const matchedAdIds = new Set(matched.map((ad) => ad.id));
    for (const row of insights) {
      if (!matchedAdIds.has(row.ad_id)) continue;
      spend += Number.parseFloat(row.spend ?? "0") || 0;
      reach += Number.parseFloat(row.reach ?? "0") || 0;
    }
  } catch (err) {
    console.log(`성과를 읽지 못함 — ${err.message}`);
  }

  console.log(
    `광고 ${ads.length}건 / 우리 게시물 ${matchedMedia.size}건 매칭 ✅ ` +
      `(지출 ${won(spend)} ${account.currency ?? ""} · 도달 ${won(reach)})`,
  );
  findings.push({ account, matchedMedia, matchedAds: matched.length, spend });
}

// --- 결론 ------------------------------------------------------------------

console.log("");
if (findings.length === 0) {
  console.log("우리 게시물에 붙은 광고를 어느 계정에서도 찾지 못했습니다.");
  console.log(
    "→ 인스타그램 앱 '홍보하기' 부스트가 Marketing API에 올라오지 않는 계정 구조입니다.\n" +
      "  자동 집계 경로가 없어 지금처럼 수동 입력을 유지해야 합니다.",
  );
  process.exit(2);
}

findings.sort((a, b) => b.matchedMedia.size - a.matchedMedia.size);
const best = findings[0];
console.log("찾았습니다. 아래 값을 설정에 넣으면 자동 집계가 켜집니다:\n");
console.log(`  META_AD_ACCOUNT_ID=${best.account.id}`);
console.log(`  META_ADS_TOKEN=<방금 쓴 토큰>\n`);
console.log(
  `  게시물 ${best.matchedMedia.size}건 · 광고 ${best.matchedAds}건 · ` +
    `지출 ${won(best.spend)} ${best.account.currency ?? ""}`,
);
if (findings.length > 1) {
  console.log(
    `\n  (다른 계정 ${findings.length - 1}개에도 매칭이 있습니다 — 여러 계정에 나눠 집행했다면 알려주세요.)`,
  );
}
