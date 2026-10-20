# Saju Service — Your Life Flow by 10-Year Luck Periods

**English** · [한국어](README.ko.md)

A web service that reads your **saju** (Korean Four Pillars of Destiny) from your birth date, time and place, and shows your life as a timeline of **10-year luck periods (대운)** — past, present and future. It was built feature by feature with an AI agent, using written specs and automated tests.

**[Open the service](https://saju-service-steel.vercel.app/)** · Current version: **v0.3.1** · [Changelog](CHANGELOG.md) (Korean)

## What you can do

- **Calculate your chart**: enter a solar or lunar birth date (including leap months), birth time and birth city. The city's time zone and longitude are applied.
- **See your life flow**: your own 10-year luck periods in time order, with the current period highlighted, a life graph and "four seasons of life".
- **Read the explanation**: an instant rule-based reading runs in your browser. If you agree, an optional AI reading (Gemini) adds a deeper summary.
- **Daily fortune**: a short fortune for the day, refreshed at 09:00 Korean time.
- **Save and share**: keep one result in this browser, or log in with Google to save it privately to your account. A share card shows only a one-line message, not your birth details.

Readings are for reflection. They do not predict or guarantee events.

## Privacy

- The rule-based reading is calculated in your browser and sends nothing.
- The AI reading runs only after you agree. Only the calculated chart values are sent to Gemini — never your raw birth date, time or place.
- Account saving uses Supabase with row-level security: each person can only read and delete their own records.

## Run it yourself

Needs Node.js 22.9 or later.

```sh
npm ci
npm run dev
```

Open the address shown in the terminal.

Optional settings go in `.env.local` (see `.env.example`). Without them the chart and rule-based reading still work; the AI reading returns "unavailable" and login is turned off.

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Google login and account saving |
| `GEMINI_API_KEY` | AI reading (server only) |
| `CRON_SECRET` | Protects the daily 09:00 job |

Checks:

```sh
npm run check   # type check + all automated tests
npm run build   # production build
```

## Built with

Next.js 16, React 19, TypeScript, `lunar-javascript` for the calendar, Supabase (login and storage), Google Gemini, and Vercel (hosting and the daily job).

## How it is organised

```text
├── app/                 Screens, and API routes in app/api
├── lib/saju/            Saju calculation and reading rules
├── lib/account/         Account saving
├── supabase/migrations/ Database tables and access rules
├── tests/               Automated tests
├── docs/
│   ├── PRD.md           Product goals and scope
│   ├── specs/           One document per feature, with test results
│   └── status.md        Which features are finished and verified
└── AGENTS.md            Working rules for the AI agent
```

Each feature starts as a spec in `docs/specs/`, is built and tested, and is ticked in `docs/status.md` only after it has been verified. Some features are built but still wait for a person to check them on screen; `docs/status.md` shows which. The documents in `docs/` are written in Korean.
