# Connecting a real Instagram account

> [한국어 안내는 아래에 있습니다 ↓](#한국어-instagram-연동-가이드)

This app talks to the **Instagram API with Instagram Login** (`https://graph.instagram.com`, `v23.0`).
It needs exactly one credential: a **long-lived Instagram User access token**. You paste it into the
dashboard's **⚙️ Settings** screen — the token is stored only in `data/settings.json` on your
machine (gitignored) and shown masked. The account's user ID is discovered automatically from the
token, so you don't configure any IDs.

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
3. Under **business login settings / permissions**, make sure these scopes are requested:
   - `instagram_business_basic` — read profile, media
   - `instagram_business_manage_insights` — read reel & account insights
4. **Add your Instagram account as a tester** and accept the invite from within the Instagram app
   (*Settings → Apps and websites → Tester invites*), if the flow asks for it.
5. **Generate a token** for your account from the setup screen. You'll get a short-lived token first.
6. **Exchange it for a long-lived token** (~60 days). You can do this from the setup UI if offered,
   or with a request like:

   ```bash
   curl -s "https://graph.instagram.com/access_token\
   ?grant_type=ig_exchange_token\
   &client_secret=YOUR_APP_SECRET\
   &access_token=SHORT_LIVED_TOKEN"
   ```

   The response contains a long-lived `access_token`.
7. **Paste the long-lived token** into the app: open `/settings`, put it in the Instagram Access
   Token field, and save. Then click **Sync** on the dashboard to pull your reels and followers.

## Keeping it working

- **Tokens expire (~60 days).** Refresh before expiry by re-generating from the setup screen, or:

  ```bash
  curl -s "https://graph.instagram.com/refresh_access_token\
  ?grant_type=ig_refresh_token\
  &access_token=CURRENT_LONG_LIVED_TOKEN"
  ```

  Paste the new token back into `/settings`.
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
필요한 것은 단 하나, **장기(long-lived) Instagram User 액세스 토큰**이다. 대시보드 **⚙️ 설정**
화면에 붙여넣으면 되고, 토큰은 이 PC의 `data/settings.json`에만 저장되며(gitignore) 화면에는
마스킹되어 보인다. 계정 ID는 토큰에서 자동으로 알아내므로 따로 입력할 필요가 없다.

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
3. 권한(scope)에 다음이 포함되도록 한다.
   - `instagram_business_basic` — 프로필·미디어 읽기
   - `instagram_business_manage_insights` — 릴스·계정 인사이트 읽기
4. 흐름에서 요구하면 **본인 인스타 계정을 테스터로 추가**하고 인스타 앱에서 초대를 수락한다.
5. 설정 화면에서 **토큰 생성**(먼저 단기 토큰이 나온다).
6. **장기 토큰으로 교환**(약 60일). UI에서 지원하면 거기서, 아니면:

   ```bash
   curl -s "https://graph.instagram.com/access_token\
   ?grant_type=ig_exchange_token\
   &client_secret=앱_시크릿\
   &access_token=단기_토큰"
   ```

7. 발급된 **장기 토큰을 `/settings`에 붙여넣고 저장** → 대시보드 **동기화** 클릭.

### 유지 관리

- 토큰은 약 60일 후 만료된다. 만료 전 `refresh_access_token`으로 갱신하거나 설정 화면에서 다시
  생성해 `/settings`에 붙여넣는다.
- 계정·API 버전에 따라 일부 지표는 미지원일 수 있다. 동기화는 계속되며, 실제 `0`과 미지원/미수집은
  구분해서 표시된다.
