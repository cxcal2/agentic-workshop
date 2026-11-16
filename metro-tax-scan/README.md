# Metro Tax Scan

Daily unpaid property-tax and tax-sale opportunity scanner for **Fulton**, **Henry**, **Cobb**, and **DeKalb** counties (Atlanta metro).

## What it does

- Pulls public county tax-sale / delinquent listings
- Stores opportunities in Postgres (PGlite locally)
- Marks **new** parcels since the prior scan
- Auto-scans when the last successful run is older than 20 hours
- Supports an external daily cron via `GET /api/cron` + `CRON_SECRET`

## Georgia context

Georgia runs **redeemable tax-deed sales**, not classic tax-lien certificates. Cobb also publishes a monthly **delinquent tax list** useful for pre-sale outreach. Always verify on the official county source before bidding or paying.

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

## Daily automation

1. Set app secret `CRON_SECRET` in Cursor
2. Schedule a daily HTTP GET to `/api/cron` with header:
   `Authorization: Bearer <CRON_SECRET>`

## Sources

- DeKalb: public tax-sale HTML listing
- Cobb: monthly delinquent tax list PDF
- Fulton: Sheriff tax/levy sale PDF postings (often scanned)
- Henry: Document Center tax-sale PDF
