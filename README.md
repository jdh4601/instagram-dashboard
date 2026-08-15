<!-- markdownlint-disable MD013 -->

# Instagram Dashboard

[![CI](https://github.com/jdh4601/instagram-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/jdh4601/instagram-dashboard/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js 22.16+](https://img.shields.io/badge/node-%3E%3D22.16-339933.svg)](./package.json)

> **English** · [한국어](./README.ko.md)

A local-first, self-hosted analytics dashboard for Instagram professional accounts. It syncs
Reels and carousel metrics, finds account-funnel bottlenecks, and turns transcripts and performance
data into practical content recommendations.

![Instagram Dashboard populated with fictional demo data](./docs/screenshots/dashboard.png)

## Why this project?

Instagram Insights gives you numbers, but it does not always make the next action obvious. This
project combines deterministic analysis with an optional LLM layer:

- **Account funnel** — reach → profile visits → follows or bio-link clicks, with 7-day changes
- **Reels and carousel analytics** — views, reach, engagement, saves, shares, watch time, and replay
  signals where the API supports them
- **Audience mix** — follower versus non-follower reach
- **Rule-based diagnosis** — reproducible strengths, weaknesses, and bottlenecks
- **Transcript analysis** — upload SRT captions and generate hooks, endings, and segment-level fixes
- **Reel breakdowns** — turn saved hook links into beat clips, original/translated dialogue, and a
  16-type hook classification
- **Graph API sync** — pagination, optional-metric fallback, history snapshots, and deleted-post
  cleanup
- **Daily email report** — optional recent-performance summary through Resend
- **Bring your own LLM** — Anthropic, OpenAI, Kimi, or Google Gemini

The demo account and screenshot are fictional. You can explore the full dashboard without an
Instagram account or paid API key.

## Quick start

### Requirements

- Node.js 22.16 or newer
- npm 10 or newer
- `ffprobe` from FFmpeg for automatic Reel-duration detection during real-account sync
- Reel breakdowns additionally require `yt-dlp`, FFmpeg (`ffmpeg`/`ffprobe`), an OpenAI
  transcription key, and an active vision-capable LLM provider

### Run with demo data

```bash
git clone https://github.com/jdh4601/instagram-dashboard.git
cd instagram-dashboard
npm install
npm run seed:demo
npm run doctor
npm run dev
```

Open <http://localhost:3000>. The dashboard will contain fictional Reels, account snapshots, and
diagnoses.

`ffprobe` is optional for the demo. On macOS, install it with `brew install ffmpeg`; on
Ubuntu/Debian, use `sudo apt-get install ffmpeg`. The Docker image already includes it.
For local Reel breakdowns on macOS, install `yt-dlp` with `brew install yt-dlp`.

## Connect an Instagram account

You need an Instagram **Business or Creator** account and a Meta developer app using Instagram API
with Instagram Login. The app requests:

- `instagram_business_basic`
- `instagram_business_manage_insights`

The recommended connection flow is OAuth:

1. Copy the example configuration.

   ```bash
   cp .env.example .env.local
   ```

2. In `.env.local`, set:

   ```dotenv
   INSTAGRAM_APP_ID=your-app-id
   INSTAGRAM_APP_SECRET=your-app-secret
   INSTAGRAM_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/instagram/callback
   ```

3. Register the same redirect URI in the Meta app, restart the dashboard, and open
   <http://localhost:3000/settings>.
4. Select **Connect with Instagram**, then return to the dashboard and select **Sync**.

The server validates a short-lived OAuth state, exchanges the authorization code, and stores only
the long-lived token in owner-only `data/settings.json`. You can also paste a long-lived token
manually. For multi-instance deployments, inject it as `INSTAGRAM_ACCESS_TOKEN` instead.

See [the complete Instagram setup guide](./docs/INSTAGRAM_SETUP.md) for Meta app setup, tester
access, token refresh, and troubleshooting.

## Configure an LLM

Open **Settings** at `/settings`, choose a provider and model, and add the API key. LLM features are
optional; metric collection and rule-based diagnosis work without them.

| Provider        | Default model                   |
| --------------- | ------------------------------- |
| Anthropic       | `claude-opus-4-8`               |
| OpenAI          | `gpt-4o`                        |
| Kimi (Moonshot) | `moonshot-v1-8k-vision-preview` |
| Google Gemini   | `gemini-2.0-flash`              |

Keys entered through the UI are stored in `data/settings.json`, excluded from Git, restricted to
the file owner on supported systems, and masked in API responses.

## Choose a storage backend

Analytics repositories share one adapter contract, so the application code works with JSON,
SQLite, or PostgreSQL.

| Adapter    | Best for                                       | Configuration                               | Notes                                    |
| ---------- | ---------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| JSON       | Trying the app, existing local installs        | `STORAGE_ADAPTER=json`                      | Zero configuration; default              |
| SQLite     | A persistent single-host deployment            | `STORAGE_ADAPTER=sqlite`                    | One database under `DATA_DIR` by default |
| PostgreSQL | Multiple instances or non-persistent app disks | `STORAGE_ADAPTER=postgres` + `DATABASE_URL` | Shared analytics storage                 |

To migrate existing JSON analytics to SQLite:

```bash
npm run data:backup
npm run storage:migrate:sqlite
# Set STORAGE_ADAPTER=sqlite, then restart the app.
```

The migration refuses to merge into a populated SQLite database unless `--merge` is explicitly
provided. SQLite needs a persistent filesystem and is not durable on ephemeral/serverless disks.

Credential settings are deliberately separate from analytics storage. For horizontally scaled
deployments, provide the supported runtime credentials (`INSTAGRAM_ACCESS_TOKEN` and
`ANTHROPIC_API_KEY`) through your platform's secret manager. Other LLM providers currently require
a settings file on each instance.

## Back up data

Create a credential-free backup before upgrades or large syncs:

```bash
npm run data:backup
```

Backups are written under `backups/`. JSON analytics and a consistent live SQLite snapshot are
included; `settings.json` is intentionally excluded because it contains credentials.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Open <http://localhost:3000>. Compose mounts `./data` at `/app/data`, so JSON, SQLite, and local
settings survive container replacement. When using PostgreSQL, set `STORAGE_ADAPTER=postgres` and
`DATABASE_URL` in `.env`.

The production image runs as a non-root user and includes FFmpeg.

## Environment reference

All variables are documented in [`.env.example`](./.env.example). The main groups are:

| Purpose                   | Variables                                                                  |
| ------------------------- | -------------------------------------------------------------------------- |
| Storage                   | `DATA_DIR`, `STORAGE_ADAPTER`, `SQLITE_DATABASE_PATH`, `DATABASE_URL`      |
| Instagram OAuth           | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_OAUTH_REDIRECT_URI` |
| Stateless Instagram token | `INSTAGRAM_ACCESS_TOKEN`                                                   |
| Dashboard protection      | `DASHBOARD_USER`, `DASHBOARD_PASSWORD`                                     |
| LLM fallback              | `ANTHROPIC_API_KEY`                                                        |
| Daily report              | `CRON_SECRET`, `RESEND_API_KEY`, `REPORT_EMAIL_FROM`, `REPORT_EMAIL_TO`    |

Run `npm run doctor` after changing configuration. It checks the Node version, data-directory
access, storage selection, auth completeness, FFmpeg, file permissions, and optional integrations
without printing secret values.

## Deployment security

This is a local-first, single-operator application. Basic Auth is disabled by default.

Before exposing it outside localhost or a trusted network:

- set both `DASHBOARD_USER` and `DASHBOARD_PASSWORD`;
- use HTTPS;
- keep `.env*` and `data/settings.json` outside source control;
- use a persistent disk for JSON/SQLite, or PostgreSQL for shared/ephemeral deployments;
- configure `CRON_SECRET` before enabling the daily-report endpoint;
- run `npm run doctor`.

If only one Basic Auth variable is set, the application fails closed with `503`. See the
[security policy](./SECURITY.md) for vulnerability reporting and the supported deployment model.

## Development

```bash
npm run doctor
npm test
npm run typecheck
npm run build
```

CI runs the production dependency audit, PostgreSQL integration test, Vitest suite, TypeScript
check, and Next.js production build.

```text
app/              Next.js pages and API routes
components/       Dashboard and reusable UI components
lib/analysis/     Deterministic metrics and diagnosis
lib/graph/        Instagram Graph API client and sync
lib/store/        JSON, SQLite, and PostgreSQL adapters
lib/settings/     Credential settings and masking
scripts/          Doctor, backup, migration, and report helpers
```

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Additional documentation

- [Instagram account setup](./docs/INSTAGRAM_SETUP.md)
- [Daily report and launchd setup](./scripts/launchd/README.md)
- [Open-source readiness and history audit](./docs/OPEN_SOURCE_AUDIT.md)
- [Security policy](./SECURITY.md)

## License

[MIT](./LICENSE) © 2026 DongHyun Jung
