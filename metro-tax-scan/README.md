# Metro Tax Scan

Daily unpaid property-tax and tax-sale opportunity scanner for **any Georgia county** (all 159 local governments).

## What it does

- Registry of every Georgia county with tax-office links (from GA DOR where available)
- **Specialized collectors** for Fulton, Henry, Cobb, and DeKalb
- **Generic harvester** for other counties: follows tax-sale / delinquent links and PDF lists
- Save custom listing URLs per county when the directory has no scrape target yet
- Stores opportunities in Postgres (PGlite locally)
- Marks **new** parcels since the prior scan
- Auto-scans enabled counties when the last successful run is older than 20 hours
- External daily cron via `GET /api/cron` + `CRON_SECRET`

## Georgia context

Georgia runs **redeemable tax-deed sales**, not classic tax-lien certificates. Always verify on the official county source before bidding or paying.

## Local development

```bash
npm install
env -u DATABASE_URL npm run dev
```

Optional smoke tests:

```bash
npm run smoke
npm run smoke:cobb
```

## Selecting counties

In the dashboard:

1. Search any county or seat
2. Enable checkboxes (presets: Metro Atlanta, All with URLs)
3. Optionally paste a tax-sale / delinquent listing URL and save
4. Run scan

API:

- `GET /api/counties?q=`
- `PUT /api/counties` with `{ enabledCounties, setOverride }`
- `POST /api/scan` with optional `{ counties: ["chatham","richmond"] }`

## Daily automation

1. Set app secret `CRON_SECRET` in Cursor
2. Schedule a daily HTTP GET to `/api/cron` with header:
   `Authorization: Bearer <CRON_SECRET>`
