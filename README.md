<!-- Language: **English** · [한국어](./README.ko.md) -->

# AI Reels Analyzer

> **English** · [한국어](./README.ko.md)

A **local AI dashboard** for Instagram Reels accounts (built for a founder-interview channel).
It reads Instagram Graph API metrics, **diagnoses where your Reels funnel leaks**
(3-second hook → CTA → follow), and **suggests fixes tailored to your content**. Optionally, it
emails you a **daily best/worst report with an LLM-written summary** every morning.

- **Diagnosis is deterministic (rule-based, testable); only creative generation uses an LLM** — so
  the analysis is always reproducible.
- Each metric uses `views` or `reach` as the denominator depending on intent, and the formula is
  shown on screen.
- Data is stored in local JSON files (`data/`, gitignored).
- **Bring your own LLM provider** — Anthropic (Claude) / OpenAI / Kimi (Moonshot) / Gemini. Add the
  key in the dashboard settings screen.

## Features

| Feature | What it does |
|---|---|
| 🩺 Diagnosis | Classifies 7 metrics (3s hook, completion, share, save, like, comment, follow-conversion) into strengths / weaknesses / bottleneck |
| ⚡ Bottleneck banner | Highlights the single weakness with the largest weight×gap as "this week's bottleneck," with delta vs. the last 3-reel average |
| 💡 Solutions | Weakness → prescription rule playbook (cold open, share triggers, ending CTA, etc.) |
| 📈 Views trend | Accumulates per-reel views/reach on every sync into a time series (incl. replays, follows, profile visits) |
| 👥 Follower graph | Follower count over time with a delta badge vs. the previous point |
| ✨ AI generation | LLM generates 3 hook options, 3 ending options, per-segment prescriptions, and content notes from the diagnosis + transcript |
| 📝 Transcript deep-dive | Sends transcript (SRT) + performance metrics to an LLM to explain *why* things worked or didn't, cached on the reel |
| 📧 Daily report | Emails the last month's best/worst reels + follower/reach summary + an LLM summary each morning (via Resend) |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Recharts 3 · Zod 4 ·
lucide-react · Jest 30 · `@anthropic-ai/sdk` (Claude `claude-opus-4-8`) · `openai` (OpenAI-compatible
providers) · `resend` (email delivery)

## Quick start (try it with demo data)

You can explore the whole dashboard with a fictional account — no Instagram token required.

```bash
npm install
npm run seed:demo   # copies examples/demo-data → data/ (a fictional sample account)
npm run dev
```

Open <http://localhost:3000> and you'll see reels, diagnosis, and follower charts already populated.
To connect a real account, follow the **Settings** section below and the
[Instagram setup guide](./docs/INSTAGRAM_SETUP.md).

> `seed:demo` only seeds when `data/` is empty. If you already have real data, overwrite it
> explicitly with `npm run seed:demo -- --force`.

## ⚠️ Security notice (please read)

This app has **no login / authentication.** Anyone who can reach it can change settings (store your
Instagram token and LLM keys) and trigger paid LLM calls. For convenience, `dev`/`start` bind to
`0.0.0.0` (reachable from your LAN).

- Run it **only on localhost or a trusted LAN.**
- If you must expose it to the internet, **put an authentication layer in front of it** (e.g. a
  reverse proxy with Basic Auth). Do **not** deploy it on a public VPS/IP as-is — that exposes an
  unauthenticated credential-storage and LLM-spend surface.
- `data/` (tokens, keys, collected data) and `.env` are gitignored — never commit them.

## LLM provider setup

In the top-right **⚙️ Settings** (`/settings`), enter the API key and model for your provider and
pick the active one. Keys are stored only in `data/settings.json` on this machine (gitignored) and
are shown masked in the UI.

| Provider | Default model | Connection |
|---|---|---|
| Anthropic (Claude) | `claude-opus-4-8` | native |
| OpenAI | `gpt-4o` | OpenAI-compatible |
| Kimi (Moonshot) | `moonshot-v1-8k-vision-preview` | OpenAI-compatible |
| Google Gemini | `gemini-2.0-flash` | OpenAI-compatible |

> The `ANTHROPIC_API_KEY` env var is only a fallback used when no key is set in Settings.

## Usage

1. **Add reels** — register aggregate metrics (views, likes, comments, saves, shares, avg watch
   time, etc.) as JSON:

   ```bash
   curl -X POST localhost:3000/api/reels \
     -H 'Content-Type: application/json' \
     -d @__tests__/fixtures/sample-reel.json
   ```

   Or [connect a real account](./docs/INSTAGRAM_SETUP.md) and use the dashboard's **Sync** button to
   pull from the Graph API automatically.

2. **Attach a transcript (SRT)** — attach a `.srt` exported from CapCut auto-captions on the reel
   detail screen to analyze the hook and CTA alongside performance. Running the LLM deep-dive caches
   the reasons things worked / didn't on the reel.

3. **Read the analysis** — select a reel to instantly see its bottleneck, diagnosis, derived
   metrics, and solutions.

4. **Track followers** — enter a date + follower count in the top form to draw the growth graph.

## Where the insights come from

| Source | Auto-collected data | Shown at |
|---|---|---|
| Derived metrics | Reach-based engagement, save/share intent, plays per reached account, replay rate, avg watch %, profile-visit / follow-conversion funnel | Reel detail & account insights |
| Instagram Graph API | Account followers, last-7-day reach/views/engagement; per-reel views, reach, reactions, watch time, replays, profile activity, follows — whichever your account supports | Account data on the main header, reel data on the detail screen |

Graph API metrics vary by API version and account type. If an optional metric isn't supported, the
basic sync still proceeds, and a real `0` is distinguished from unsupported/uncollected. Because avg
watch time ÷ video length is not a true completion rate, it's labeled **average watch percentage**.

## API

| Method | Path | Description |
|---|---|---|
| GET / POST | `/api/reels` | List reels / register one (derived metrics auto-computed) |
| GET | `/api/reels/[id]` | Get a single reel |
| POST / DELETE | `/api/reels/[id]/transcript` | Attach / remove a transcript (SRT) |
| POST | `/api/reels/[id]/transcript/analyze` | Transcript + metrics → LLM deep-dive (why it worked / didn't) |
| POST | `/api/recommend` | Reel ID → diagnosis + drop-off + rule-based prescriptions |
| POST | `/api/generate` | Reel ID → LLM generation (hooks / endings / segments / notes) |
| GET / POST | `/api/snapshots` | List / add a follower snapshot |
| GET | `/api/profile` | Get the account profile |
| GET / POST | `/api/settings` | Get (masked) / save LLM provider + Instagram token settings |
| POST | `/api/sync` | Auto-collect reels + followers from the Graph API (merge) |
| POST | `/api/cron/daily-report` | Sync → build report → send email (requires `x-cron-secret` header) |

## Daily email report

Every morning it syncs the account and emails the **top/bottom 3 reels of the last month + a
follower/reach summary + an LLM summary**. A scheduler (launchd, cron, etc.) calls
`/api/cron/daily-report` with `CRON_SECRET` in the `x-cron-secret` header. See `.env.example` and
[`scripts/launchd/README.md`](./scripts/launchd/README.md):

- `CRON_SECRET` — secret protecting the cron endpoint (`openssl rand -hex 32`)
- `RESEND_API_KEY` · `REPORT_EMAIL_FROM` · `REPORT_EMAIL_TO` — [Resend](https://resend.com) delivery
- `REPORT_URL` — endpoint the scheduler calls (omit to use the default)

## Development

```bash
npm test            # Jest unit tests (deterministic core is fully covered)
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

The analysis engine (`lib/analysis/*`) is entirely pure functions written with TDD. LLM calls are
mocked in tests and never hit the network.

## Project structure

```
app/            # dashboard pages and API routes
components/     # UI components (Recharts charts + components/ui design system)
config/         # benchmarks.ts — single source of truth for diagnosis thresholds
examples/       # demo-data — fictional sample-account seed data (seed:demo)
lib/
  schemas/      # Zod data models
  parsing/      # SRT parser
  analysis/     # metrics, diagnosis, drop-off detection, baselines, follower trend (pure)
  recommend/    # rule-based prescription playbook + LLM transcript insights
  report/       # daily report builder, LLM summary prompt, HTML render, orchestration
  email/        # Resend email delivery
  store/        # JSON-file repositories (reels, account, profile, reel history)
  llm/          # provider abstraction (Anthropic / OpenAI-compatible text models)
  graph/        # Instagram Graph API client, mapper, sync
  settings/     # LLM key + Instagram token settings store (masked)
  ui/           # formatting + chart helpers (pure)
scripts/        # demo seed + daily-report scheduler (launchd)
docs/           # Instagram setup guide + design docs
```

## Roadmap

- **Phase 1 (done)** — SRT-based diagnosis, solutions, visualization
- **Phase 2 (done)** — Instagram Graph API integration (reel aggregate metrics + follower count)
- **Phase 3 (done)** — LLM generation (3 hooks/endings, per-segment prescriptions, content notes) — provider-selectable
- **Phase 4 (done)** — transcript LLM deep-dive + daily best/worst email report with LLM summary

## Contributing

Issues and PRs are welcome. Please run `npm test` and `npm run typecheck` before opening a PR.

⭐ If this project is useful to you, a GitHub star is the easiest way to support it — thank you!

## License

[MIT](./LICENSE) © 2026 DongHyun Jung
