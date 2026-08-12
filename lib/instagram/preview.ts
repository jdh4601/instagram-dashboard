/**
 * 인스타그램 게시물 주소에서 썸네일·계정을 읽어 온다.
 *
 * Graph API는 내 계정의 미디어만 준다. 보관함에 담는 훅은 대부분 남의 릴스라
 * Graph로는 손이 닿지 않는다. 대신 인스타는 링크 미리보기용 og: 태그를 서버
 * 렌더로 내주는데, 일반 브라우저 UA로 받으면 빈 JS 껍데기만 오고 크롤러 UA로
 * 받아야 태그가 붙어 온다. 그래서 UA를 크롤러로 두고 요청한다.
 *
 * 한계: og:image는 CDN 서명 주소라 언젠가 만료된다. 저장해 둔 썸네일이 나중에
 * 깨질 수 있고, 그때는 링크를 다시 넣어 갱신해야 한다.
 */

const CRAWLER_USER_AGENT = "facebookexternalhit/1.1";
const FETCH_TIMEOUT_MS = 8000;

export interface InstagramPreview {
  thumbnailUrl: string | null;
  handle: string | null;
  displayName: string | null;
  caption: string | null;
}

const EMPTY_PREVIEW: InstagramPreview = {
  thumbnailUrl: null,
  handle: null,
  displayName: null,
  caption: null,
};

/**
 * 서버가 이 주소로 직접 요청을 보낸다. 사용자가 넣은 문자열을 그대로 fetch하면
 * 사내망이나 로컬호스트를 겨누는 통로가 되므로, 호스트와 경로를 둘 다 고정한다.
 */
export function isInstagramPostUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.hostname !== "instagram.com" && url.hostname !== "www.instagram.com") return false;
  return /^\/(reel|reels|p|tv)\/[^/]+\/?$/.test(url.pathname);
}

/** 인스타는 og 값을 HTML 엔티티로 이스케이프해 보낸다. 그대로 두면 화면에 코드가 찍힌다. */
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readMeta(html: string, property: string): string | null {
  // property가 content보다 뒤에 오는 순서도 있어 양쪽을 다 본다.
  const forward = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const backward = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`,
    "i",
  );
  const match = html.match(forward) ?? html.match(backward);
  return match ? decodeEntities(match[1]) : null;
}

/**
 * og:description은 `handle on June 27, 2026: "본문"` 꼴로 온다.
 * 형태가 다르면 핸들을 지어내지 않고 비워 둔다 — 틀린 계정을 붙이느니 빈 칸이 낫다.
 */
function readHandleAndCaption(description: string | null): {
  handle: string | null;
  caption: string | null;
} {
  if (!description) return { handle: null, caption: null };

  // 로케일에 따라 "handle on June 27, 2026:" 또는 "handle - June 27, 2026:"으로 온다.
  const match = description.match(/^([A-Za-z0-9._]+)\s+(?:on|-|·)\s+[^:]+:\s*(.*)$/s);
  if (!match) return { handle: null, caption: description.trim() || null };

  const caption = match[2].replace(/^["“”]+|["“”]+$/g, "").trim();
  return { handle: match[1], caption: caption || null };
}

/**
 * og:title 꼴이 로케일마다 다르다: `표시 이름 | 소개`, `Instagram의 표시 이름`,
 * `표시 이름 on Instagram`. 셋 다에서 계정 이름만 남긴다.
 */
function readDisplayName(title: string | null): string | null {
  if (!title) return null;

  const name = title
    .split("|")[0]
    .replace(/^Instagram의\s+/, "")
    .replace(/\s+on\s+Instagram$/i, "")
    .replace(/^Instagram\s+/, "")
    .trim();
  return name || null;
}

export function parseInstagramPreview(html: string): InstagramPreview {
  const description = readMeta(html, "og:description");
  const { handle, caption } = readHandleAndCaption(description);

  return {
    thumbnailUrl: readMeta(html, "og:image"),
    handle,
    displayName: readDisplayName(readMeta(html, "og:title")),
    caption,
  };
}

export async function fetchInstagramPreview(url: string): Promise<InstagramPreview> {
  const res = await fetch(url, {
    // 로케일에 따라 og 문구 형식이 바뀐다. 영어로 고정해 파서가 볼 형태를 하나로 둔다.
    headers: { "User-Agent": CRAWLER_USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`인스타그램이 응답하지 않았습니다 (${res.status})`);

  const preview = parseInstagramPreview(await res.text());
  if (!preview.thumbnailUrl && !preview.handle) {
    // 비공개 계정이거나 인스타가 크롤러에게도 껍데기를 준 경우다.
    throw new Error("게시물 정보를 읽지 못했습니다. 공개 게시물인지 확인해 주세요.");
  }
  return preview;
}

export const EMPTY_INSTAGRAM_PREVIEW = EMPTY_PREVIEW;
