# 나의 대운, 나의 시간 (My Daewoon, My Time)

**English** · [한국어](README.ko.md)

A Korean-language web service that reads your *saju* (Four Pillars of Destiny) from your birth date, time and place, and shows your life as a timeline of roughly 10-year periods called *daewoon*: the past, the period you are in now, and what comes next.

Live site: https://saju-service-steel.vercel.app

> Results are for entertainment and self-reflection only. They are not medical, legal, financial or any other professional advice, and they do not predict events.

## What it does

- **Birth input**: solar or lunar birth date (including leap months; if you are not sure, both possible dates are shown so you can choose), birth time, and birth country and city. The city's time zone and longitude are used in the calculation. Births from 1990 onward (lunar dates from 1990 to 2100) with a known birth time are supported.
- **Saju chart**: the four pillars with Chinese characters, Korean readings and the five elements, plus a short one-line message that you can save or share as an image card (the card never includes your birth details).
- **Result pages**: today's fortune (published daily at 9:00 Korean time), five elements and ten gods, balance and helpful directions, a life graph where you can write a one-line note for each period, the four "seasons" of your life, the flow of your daewoon, yearly and monthly fortunes, and life topics such as work, money, relationships and health.
- **Benefactors and special stars**: 10 traditional markers, each with a clickable explanation of what it means for your chart.
- **AI reading (optional server feature)**: Google Gemini writes a combined reading from the already-calculated chart. A short summary appears first and the full reading follows. If Gemini fails, the calculated chart stays on screen with a retry button.
- **Google login (optional)**: save results to your account and open them on another device.

## Privacy

- All saju calculations are done by this project's own code (`lib/saju`), not by the AI.
- Only computed chart data (pillars, elements, periods and similar) is sent to Gemini. Your raw birth date, birth time and birth city are never sent to Gemini. The notice is shown next to the submit button.
- Without logging in, the latest result (and any life-graph notes you write) is kept only in your browser's `localStorage`.
- If you log in with Google and press "Save to account", the birth input, chart and reading are stored in Supabase. Database row-level security (RLS) lets only the owner read, save and delete their own records.
- The Gemini API key is used only on the server and is never sent to the browser.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript
- `lunar-javascript` for the Chinese calendar and four pillars
- Supabase for Google login and account storage
- Google Gemini (`@google/genai`), called only from server API routes
- Deployed on Vercel (a daily cron job prepares the shared "today" data)

## Run it locally

Requires Node.js 22.9 or newer.

```sh
npm ci          # install the exact versions in package-lock.json
npm run dev     # start the development server, then open the address shown
npm run check   # type check and run all tests
npm run build   # production build
```

The site works without any environment variables; only the features in the table below are turned off.

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. Never commit real values.

| Variable | Used for | Without it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Google login and account storage | Login and account save/list/open/delete do not work. Calculation and browser storage still work. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Google login and account storage | Same as above. |
| `GEMINI_API_KEY` | AI reading (server only) | `/api/reading` returns HTTP 503 with error code `missing_api_key`. The calculated chart and local readings still work. |
| `CRON_SECRET` | Protecting the daily cron route | `/api/cron/daily` always returns HTTP 401. Today's fortune is still computed when someone visits. |
| `AI_RATE_LIMIT_WINDOW_SECONDS` | Optional. Time window for the AI request limits | Uses 600 seconds (10 minutes). |
| `READING_RATE_LIMIT_PER_IP` | Optional. `/api/reading` requests allowed per IP address in the window | Uses 6. One reading uses 2 requests (short summary + full reading), so this is about 3 readings. |
| `READING_RATE_LIMIT_GLOBAL` | Optional. `/api/reading` requests allowed per server instance in the window | Uses 60. |
| `CONSULTATION_RATE_LIMIT_PER_IP` | Optional. `/api/consultation` requests allowed per IP address in the window | Uses 3. Raise it (for example to 10) in `.env.local` before running `scripts/verify-deep-consultation.ts`, which asks for 8 chapters. |
| `CONSULTATION_RATE_LIMIT_GLOBAL` | Optional. `/api/consultation` requests allowed per server instance in the window | Uses 20. |

Limit values must be plain decimal whole numbers of 1 or more (for example `10`). Values such as `1e1`, `0x10`, `5.0`, `0` or negative numbers fall back to the default. Values above the maximum (window 86400 seconds, per IP 10000, per instance 100000) are reduced to the maximum.

### AI request protection

The two routes that call Gemini (`/api/reading`, `/api/consultation`) have two simple guards in front of them, so that strangers cannot easily spend the project's Gemini credits:

- **Same-site check**: a request sent by a browser from another website gets HTTP 403 (`forbidden_origin`). Requests from this site, its Vercel preview addresses and `localhost` are allowed. Requests that carry no browser origin information at all (for example `curl` or scripts) are not blocked by this check; only the request limit below applies to them.
- **Request limit**: requests that pass input checks are counted per IP address and per server instance. Over the limit, the route returns HTTP 429 (`too_many_requests`) with a `Retry-After` header, before any Gemini call. The page then shows "요청이 많아 잠시 쉬어 갑니다. N분 뒤에 다시 시도해 주세요." instead of a reading; it never shows a made-up reading.

These counters live in each server's memory. Vercel can run several copies of the server and restart them at any time, so the limit is a best effort, not an exact global limit. For a real global limit, the project owner should also add a rate-limit rule for `/api/reading` and `/api/consultation` in the Vercel dashboard (Firewall).

## Folder map

```text
├── app/                 Screens: input form, result pages, navigation, account panel
│   └── api/
│       ├── reading/       AI reading (Gemini, server only)
│       ├── daily/         Shared data for today's fortune
│       ├── cron/daily/    Daily cron job (needs CRON_SECRET)
│       ├── locations/     Country and city search
│       └── consultation/  Chapter-by-chapter consultation API (not shown in the current UI)
├── lib/
│   ├── saju/            Saju calculation, local readings, AI prompts and response checks
│   ├── request-guard*.ts Same-site check and request limits for the AI routes
│   ├── account/         Saving and loading results in the user's account
│   └── supabase/        Supabase browser client
├── supabase/migrations/ Database table and owner-only access rules
├── scripts/             Manual check scripts (AI reading samples, account access rules) and city-name data generation
├── tests/               Automated tests
├── docs/                Product plan (PRD), feature specs and progress (Korean)
├── public/              Images
└── AGENTS.md            Rules for AI coding agents working on this repository
```

## How work is done in this repository

1. The product plan is in `docs/PRD.md`.
2. Each change gets a numbered spec in `docs/specs/` (for example `045-maintenance-security-docs-a11y.md`) describing what it should do and how it will be checked.
3. The spec is added to `docs/status.md` as an unchecked item `- [ ]`.
4. After implementation, tests are written or extended by someone other than the implementer, and the results (including what was not checked) are recorded in the spec.
5. The item is changed to `- [x]` only after implementation and verification are both finished.

The documents in `docs/` are written in Korean. Version history is in `CHANGELOG.md`.
