# Phase 4 — Next.js Dashboard

Interactive insights dashboard matching `frontend-references/` Stitch designs.

## Prerequisites

- Node.js 20+
- Backend running at `http://localhost:8000` (see `backend/README.md`)
- Phase 3 synthesis completed at least once

## Run locally

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to production

See [docs/deployment.md](../docs/deployment.md) for Render (backend), Vercel (frontend), and GitHub Actions setup.

## Branding and assets

| Asset | Path | Purpose |
|---|---|---|
| App logo | `public/app-logo.webp` | Sidebar (circular frame) |
| Favicon | `public/favicon-32.webp`, `src/app/icon.webp` | Browser tab / Next.js app icon |
| Apple touch icon | `public/apple-touch-icon.webp`, `src/app/apple-icon.webp` | Mobile home screen |

Product title in the sidebar: **Spotify Review Analysis Engine**.

## Pages

| Route | Description |
|---|---|
| `/` | Executive overview — live KPIs, research-agenda executive summary, pain points, opportunities, source mix, question preview cards |
| `/pm-buddy` | PM Buddy chat — evidence-backed Groq copilot focused on why discovery is hard and why repetitive listening persists |
| `/questions/[id]` | Question detail — themes, narrative, source donut, rating chart, filterable quote gallery |
| `/trends` | Live review trends — dual-axis chart (net sentiment + avg rating) with Weekly / Monthly / Yearly toggle |
| `/runs` | Synthesis run history |
| `/synthesis` | In-progress synthesis status |

Home page subtitle frames the primary research agenda: why meaningful discovery is hard and why listening still clusters on repeat playlists, familiar artists, and previously discovered tracks.

## Client architecture

- **`InsightsDataProvider`** (root layout) — caches `/api/insights/latest` and `/api/insights/trends` for ~60s so tab switches feel instant
- **`QuestionsBundleProvider`** — shares the insights bundle across question pages without refetching on every navigation
- **`ColdStartLoadingScreen`** — shown on Home and Trends during initial load while the Render backend wakes; synthesis-style steps plus cold-start disclaimer
- **`SourceMixDonut`** — shared source-mix component: large donut centred above a full-width legend (used on home, question pages, and PDF export)
- **Sidebar** — prefetches routes; uses `startTransition` for smooth navigation; Spotify logo from `/app-logo.webp`
- **Home header** — **Export Report** (multi-page PDF) and **Synthesize now** (not in the sidebar)
- **Question pages** — source filters sit above the quote gallery; mentions-by-source via `SourceMixDonut`; no per-page Synthesize button or audit footer

## Export Report

Generates a multi-page PDF snapshot of the home overview, all six question pages, and trends via `html2canvas` + `jspdf`. Tailwind v4 `oklab` colours are inlined as RGB during capture to avoid parse errors.

## Edge cases (Phase 4)

- **Synthesize now** on the home header; disabled while the pipeline is in progress; backend returns 409 on duplicate
- Empty / error states when no insights or API unreachable (improved API error messages when `NEXT_PUBLIC_API_URL` is wrong)
- **Cold start** — Home and Trends show `ColdStartLoadingScreen` on first load when Render backend is waking
- Low-confidence badge when source sample &lt; 20 reviews
- Dashboard shows latest **successful** run (not partial writes)
- PM Buddy returns 503 when `GROQ_API_KEY` is not configured on the backend
- Trends sentiment reflects star-rating distribution (see `backend/README.md`), not Groq text sentiment
- Trends chart x-axis starts **Jan 2026** (`TRENDS_CHART_START` on backend)
