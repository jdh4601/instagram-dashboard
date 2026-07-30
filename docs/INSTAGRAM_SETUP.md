# Connecting a real Instagram account

> [한국어 안내는 아래에 있습니다 ↓](#한국어-instagram-연동-가이드)

This app talks to the **Instagram API with Instagram Login** (`https://graph.instagram.com`, `v23.0`).
It needs a **long-lived Instagram User access token**. The recommended setup lets the app complete
Meta's OAuth code exchange for you; manual token paste remains available. The resulting token is
stored only in `data/settings.json` on your machine (gitignored, owner-only) and shown masked.
The account's user ID is discovered automatically from the token.

> **Prefer to just look around first?** You don't need any of this to try the app —
> run `npm run seed:demo && npm run dev` for a fully populated demo. Come back here when you want
> your own data.

## Prerequisites

1. An **Instagram professional account** (Business or Creator). Personal accounts can't use the API.
   Switch in the Instagram app: *Settings → Account type and tools → Switch to professional account.*
2. A **Meta developer account** — <https://developers.facebook.com/>.

## Steps

Meta's dashboard UI changes often; treat this as the shape of the flow and follow the on-screen
labels. Official docs: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login>.

1. **Create an app** at <https://developers.facebook.com/apps/> → *Create App*. Pick a use case that
   offers **Instagram** (e.g. "Other" → "Business"), or add the **Instagram** product to the app
   afterward.
2. In the app, open **Instagram → API setup with Instagram login** (a.k.a. "Instagram Business
   Login"). This is the path that issues `graph.instagram.com` tokens.
3. Under **business login settings / permissions**, make sure these scopes are requested. These
   are exactly what the app calls (see `lib/graph/client.ts`):

   | Permission | Used for |
   |---|---|
   | `instagram_business_basic` | Profile (`user_id`, `username`, `followers_count`, `media_count`, avatar) and the media list (`me/media`: id, caption, timestamp, permalink, …) |
   | `instagram_business_manage_insights` | Reel insights (`views`, `reach`, `likes`, `comments`, `saved`, `shares`, plus optional ones like `follows`, `profile_visits`, `ig_reels_avg_watch_time`, `clips_replays_count`) and account insights (`accounts_engaged`, `total_interactions`, `follows_and_unfollows`, …) |
4. **Add your Instagram account as a tester** and accept the invite from within the Instagram app
   (*Settings → Apps and websites → Tester invites*), if the flow asks for it.
5. Add this exact callback URL to the Meta app's valid OAuth redirect URIs:

   `http://localhost:3000/api/auth/instagram/callback`

6. Copy `.env.example` to `.env.local` and set all three values:

   ```dotenv
   INSTAGRAM_APP_ID=your-app-id
   INSTAGRAM_APP_SECRET=your-app-secret
   INSTAGRAM_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/instagram/callback
   ```

   Restart the app, open `/settings`, and click **Connect with Instagram**. The app validates a
   short-lived CSRF state, exchanges the code server-side, and stores only the long-lived token.

7. **Manual alternative:** generate a short-lived token in Meta's setup screen and exchange it for
   a long-lived token (~60 days):

   ```bash
   curl -s "https://graph.instagram.com/access_token\
   ?grant_type=ig_exchange_token\
   &client_secret=YOUR_APP_SECRET\
   &access_token=SHORT_LIVED_TOKEN"
   ```

   The response contains a long-lived `access_token`.
8. **Paste the long-lived token** into the app: open `/settings`, put it in the Instagram Access
   Token field, and save. Then click **Sync** on the dashboard to pull your reels and followers.

## Keeping it working

- **Tokens expire (~60 days).** Refresh before expiry by re-generating from the setup screen, or:

  ```bash
  curl -s "https://graph.instagram.com/refresh_access_token\
  ?grant_type=ig_refresh_token\
  &access_token=CURRENT_LONG_LIVED_TOKEN"
  ```

  Paste the new token back into `/settings`.
- **Don't wait for day 60.** A long-lived token can only be refreshed while it is still valid, so
  set a calendar reminder around **day 50** to run the refresh above and paste the new token into
  `/settings`. If it has already lapsed, generate a fresh token from the setup screen and
  re-exchange it for a long-lived one.
- **Some metrics may be unavailable** depending on your account and API version. Sync continues
  anyway, and the dashboard distinguishes a real `0` from an unsupported/uncollected metric.

## Troubleshooting

- **Sync fails / 400** — the token likely expired or lacks a scope. Re-generate with both scopes
  above and re-exchange for a long-lived token.
- **Empty reels after sync** — the account may have no Reels media, or the account isn't a
  professional account.
- Never paste your token into a URL you log, screenshot, or share — it grants full read access to
  your account's insights.

---

## 한국어: Instagram 연동 가이드

이 앱은 **Instagram API with Instagram Login**(`https://graph.instagram.com`, `v23.0`)을 사용한다.
필요한 것은 **장기(long-lived) Instagram User 액세스 토큰**이다. 권장 방식은 앱이 Meta OAuth
코드 교환을 처리하도록 연결하는 것이며, 수동 붙여넣기도 계속 지원한다. 결과 토큰은 이 PC의
`data/settings.json`에만 소유자 전용으로 저장되고(gitignore) 화면에는 마스킹된다.

> **일단 둘러보기만 하고 싶다면** 이 과정 없이 `npm run seed:demo && npm run dev`로 데모 데이터를
> 채운 대시보드를 먼저 볼 수 있다.

### 준비물

1. **Instagram 프로페셔널 계정**(비즈니스 또는 크리에이터). 개인 계정은 API를 못 쓴다.
   인스타 앱에서 *설정 → 계정 유형 및 도구 → 프로페셔널 계정으로 전환*.
2. **Meta 개발자 계정** — <https://developers.facebook.com/>.

### 단계

Meta 대시보드 UI는 자주 바뀌므로 아래는 큰 흐름으로 보고 화면 라벨을 따라가면 된다. 공식 문서:
<https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login>.

1. <https://developers.facebook.com/apps/>에서 **앱 생성** → Instagram을 제공하는 유형 선택(또는
   생성 후 **Instagram** 제품 추가).
2. 앱에서 **Instagram → Instagram 로그인 기반 API 설정**으로 이동. 이 경로가 `graph.instagram.com`
   토큰을 발급한다.
3. 권한(scope)에 다음이 포함되도록 한다. 앱이 실제로 호출하는 항목 기준이다
   (`lib/graph/client.ts` 참고).

   | 권한 | 사용처 |
   |---|---|
   | `instagram_business_basic` | 프로필(`user_id`, `username`, `followers_count`, `media_count`, 아바타)과 미디어 목록(`me/media`: id, 캡션, 게시 시각, permalink 등) |
   | `instagram_business_manage_insights` | 릴스 인사이트(`views`, `reach`, `likes`, `comments`, `saved`, `shares` 외 `follows`, `profile_visits`, `ig_reels_avg_watch_time`, `clips_replays_count` 등 선택 지표)와 계정 인사이트(`accounts_engaged`, `total_interactions`, `follows_and_unfollows` 등) |
4. 흐름에서 요구하면 **본인 인스타 계정을 테스터로 추가**하고 인스타 앱에서 초대를 수락한다.
5. Meta 앱의 OAuth redirect URI에 아래 주소를 정확히 등록한다.

   `http://localhost:3000/api/auth/instagram/callback`

6. `.env.example`을 `.env.local`로 복사하고 `INSTAGRAM_APP_ID`,
   `INSTAGRAM_APP_SECRET`, `INSTAGRAM_OAUTH_REDIRECT_URI`를 모두 설정한다. 앱을 재시작한 뒤
   `/settings`에서 **Instagram으로 연결**을 누른다.

7. **수동 대안:** 설정 화면에서 단기 토큰을 만들고 **장기 토큰으로 교환**한다(약 60일).

   ```bash
   curl -s "https://graph.instagram.com/access_token\
   ?grant_type=ig_exchange_token\
   &client_secret=앱_시크릿\
   &access_token=단기_토큰"
   ```

8. 발급된 **장기 토큰을 `/settings`에 붙여넣고 저장** → 대시보드 **동기화** 클릭.

### 유지 관리

- 토큰은 약 60일 후 만료된다. 만료 전 `refresh_access_token`으로 갱신하거나 설정 화면에서 다시
  생성해 `/settings`에 붙여넣는다.
- **60일까지 기다리지 않는 게 안전하다.** 장기 토큰은 유효할 때만 갱신할 수 있으므로, **50일쯤
  달력 알림**을 걸어 두고 위 갱신을 실행한 뒤 새 토큰을 `/settings`에 붙여넣자. 이미 만료가
  지났다면 설정 화면에서 토큰을 새로 생성하고 다시 장기 토큰으로 교환하면 된다.
- 계정·API 버전에 따라 일부 지표는 미지원일 수 있다. 동기화는 계속되며, 실제 `0`과 미지원/미수집은
  구분해서 표시된다.
