<!-- Language: **English** · [한국어](./README.ko.md) -->

# Instagram Dashboard

> **English** · [한국어](./README.ko.md)

A **local AI dashboard for Instagram Reels accounts**. It reads Instagram Graph API metrics,
**diagnoses where your Reels funnel leaks** (3-second hook → CTA → follow), and **suggests fixes**
— optionally emailing you a **daily best/worst report with an LLM-written summary**.

![Reels dashboard populated with fictional demo data](./docs/screenshots/dashboard.png)

## Features

- **Diagnosis** — classifies 7 metrics (hook, completion, share, save, like, comment, follow
  conversion) into strengths / weaknesses / bottleneck, deterministic and reproducible (rule-based,
  not LLM)
- **AI generation** — from a diagnosis + transcript, generates hook/ending options and
  per-segment prescriptions
- **Trend charts** — views, reach, and follower growth over time
- **Daily email report** — optional best/worst reels + LLM summary every morning
- **Bring your own LLM** — Anthropic (Claude) / OpenAI / Kimi (Moonshot) / Gemini

## Quick start (demo data, no Instagram account needed)

Requires Node.js 22.16 or newer.

```bash
npm install
npm run seed:demo   # loads a fictional sample account into data/
npm run doctor      # checks storage, auth, ffprobe, and optional integrations
npm run dev
```

Open <http://localhost:3000> — the dashboard comes pre-populated with reels, diagnosis, and
follower charts.

For real-account sync, install `ffmpeg` so its bundled `ffprobe` can read Reel durations. The
Docker image already includes it; without it, sync still works but duration-based metrics may be
unavailable.

Before an upgrade or a large sync, create a credential-free local backup:

```bash
npm run data:backup
```

The backup is written under `backups/` and intentionally excludes `data/settings.json`.
Both JSON and live SQLite data are supported.

## Storage adapters

JSON remains the zero-configuration default. Choose a backend in `.env`:

```bash
STORAGE_ADAPTER=json       # local files; backwards-compatible default
STORAGE_ADAPTER=sqlite     # one local process/server
STORAGE_ADAPTER=postgres   # shared storage; DATABASE_URL is required
```

To move existing JSON analytics data to SQLite:

```bash
npm run data:backup
npm run storage:migrate:sqlite
# then set STORAGE_ADAPTER=sqlite
```

SQLite needs a persistent filesystem and is not durable on ephemeral/serverless deployments.
Use PostgreSQL for multiple app instances or platforms without persistent local disks, and inject
the Instagram token as a platform secret with `INSTAGRAM_ACCESS_TOKEN`. On local/single-host
installs, credentials remain in owner-only `data/settings.json`; analytics backups intentionally
never include them.

## Connecting a real account

Requires a **professional (Business/Creator) Instagram account**. Full walkthrough:
[docs/INSTAGRAM_SETUP.md](./docs/INSTAGRAM_SETUP.md).

1. Create a Meta developer app with the required Instagram permissions.
2. Configure the three `INSTAGRAM_*` OAuth variables and click **Instagram connect** in
   **⚙️ Settings**, or paste a long-lived token manually.
3. Click **Sync** to pull your reels and followers.

## ⚠️ Security notice

This app supports optional **HTTP Basic Auth**. Without `DASHBOARD_USER` and
`DASHBOARD_PASSWORD`, anyone who can reach it can change stored tokens and LLM keys or trigger
paid LLM calls.

- Run it **only on localhost or a trusted LAN.**
- If exposing it to the internet, set both Basic Auth variables from [`.env.example`](./.env.example)
  or put a stronger authentication layer in front of it. Never deploy it bare on a public IP.

## LLM provider setup

Set your API key and model in **⚙️ Settings** (`/settings`). Keys are stored locally
(`data/settings.json`, gitignored) and shown masked in the UI.

| Provider | Default model |
|---|---|
| Anthropic (Claude) | `claude-opus-4-8` |
| OpenAI | `gpt-4o` |
| Kimi (Moonshot) | `moonshot-v1-8k-vision-preview` |
| Google Gemini | `gemini-2.0-flash` |

## Development

```bash
npm test            # Vitest unit tests
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

Daily email report setup (cron/launchd) is documented in
[`scripts/launchd/README.md`](./scripts/launchd/README.md).
Repository privacy findings and the owner-approved history rewrite procedure are in
[`docs/OPEN_SOURCE_AUDIT.md`](./docs/OPEN_SOURCE_AUDIT.md).

## License

[MIT](./LICENSE) © 2026 DongHyun Jung · [Security policy](./SECURITY.md)
