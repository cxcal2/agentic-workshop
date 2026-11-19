# Metro Tax Scan

Daily unpaid property-tax and tax-sale opportunity scanner for **any Georgia county** (all 159 local governments).

This app lives in the `metro-tax-scan/` folder of the repository. Run all commands from that directory unless noted otherwise.

## Use as a Cursor app

Metro Tax Scan is a **Cursor-hosted web app** (private by default):

1. Publish from this folder with Cursor Cloud (`publish-app` / the Publish control on the agent chat).
2. In the publish dialog, keep visibility **private** (or **team**) so deal data stays behind Cursor sign-in.
3. After publish, open the app from your Cursor apps list — it runs as a standalone signed-in product, not just a local repo.
4. Bind the `CRON_SECRET` secret in Cursor, then schedule a daily `GET /api/cron` with `Authorization: Bearer $CRON_SECRET` for unattended scans.
5. On phone or desktop, you can also **Add to Home Screen** / install from the browser (PWA manifest + icons are included).

Local `npm run dev` is for development; the published Cursor app is the day-to-day product surface.

## What it does

- Registry of every Georgia county with tax-office links (from GA DOR where available)
- **Specialized collectors** for Fulton, Henry, Cobb, and DeKalb
- **Generic harvester** for other counties: follows tax-sale / delinquent links and PDF lists
- Save custom listing URLs per county when the directory has no scrape target yet
- Stores opportunities in Postgres when `DATABASE_URL` is set; uses in-memory **PGlite** locally
- Marks **new** parcels since the prior scan
- Auto-scans enabled counties when the last successful run is older than 20 hours
- External daily cron via `GET /api/cron` + `CRON_SECRET`

## Georgia context

Georgia runs **redeemable tax-deed sales**, not classic tax-lien certificates. Always verify on the official county source before bidding or paying. This software is for research only — not legal or investment advice.

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| **Node.js** | 20+ (22 recommended) | Check with `node -v` |
| **npm** | 10+ | Bundled with Node; check with `npm -v` |
| **Git** | any recent | To clone the repo |
| Network | outbound HTTPS | Collectors fetch public county websites and PDFs |

Optional:

- A browser at `http://localhost:3000` (or whatever port you choose)
- `curl` for API smoke checks

No Docker, Postgres install, or `.env` file is required for local development. The app uses PGlite automatically when `DATABASE_URL` is unset.

---

## 1. Get the code

```bash
git clone https://github.com/cxcal2/agentic-workshop.git
cd agentic-workshop

# Use the feature branch that contains this app (or main if/when merged)
git checkout cursor/metro-tax-scan-7f44

cd metro-tax-scan
```

If you already have the monorepo checked out, just:

```bash
cd path/to/agentic-workshop/metro-tax-scan
```

---

## 2. Install dependencies

From `metro-tax-scan/`:

```bash
npm install
```

This installs Next.js, React, `pg`, PGlite, `cheerio`, `pdf-parse`, and TypeScript tooling.

---

## 3. Run the app locally (development)

**Important:** Unset `DATABASE_URL` so local runs use PGlite and do not write to an unrelated Postgres instance.

```bash
# macOS / Linux / WSL
env -u DATABASE_URL npm run dev
```

On Windows PowerShell:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run dev
```

Or use the npm script (already unsets `DATABASE_URL` on Unix-like shells):

```bash
npm run dev
```

Then open:

**http://localhost:3000**

You should see the **Metro Tax Scan** dashboard. Locally, Cursor identity is simulated as a signed-in “Dev Viewer” (`cursor/identity.dev.ts`) so API routes work without Cursor hosting.

### Alternate port

```bash
env -u DATABASE_URL npm run dev -- --port 3456
# → http://localhost:3456
```

---

## 4. First-time walkthrough in the UI

1. **Georgia counties** section  
   - Search by county name or seat (e.g. `Chatham`, `Savannah`).  
   - Use presets: **Metro Atlanta**, **All with URLs**, or **Clear**.  
   - Check the counties you want scanned.

2. **Optional custom listing URL**  
   - Choose a county → paste a tax-sale / delinquent list URL → **Save URL**.  
   - Use this when a county only posts lists in a place the directory does not know yet.

3. **Run scan now**  
   - Fetches public listings for enabled counties.  
   - Specialized counties (Fulton, Henry, Cobb, DeKalb) use dedicated parsers.  
   - Others use the generic page/PDF harvester.  
   - Cobb’s delinquent PDF is large; the first Cobb scan can take tens of seconds.

4. **Opportunities table**  
   - Filter by county chip, search text, min amount, list type, or “New only”.  
   - **Watch** saves parcels to your watchlist.  
   - Parcel links open the county source document.

On first load, if no successful scan exists (or the last one is older than 20 hours), the dashboard may **auto-scan** enabled counties.

---

## 5. Production-like local build

To verify a production build on your machine:

```bash
cd metro-tax-scan

# Build (runs Next build + migrate script; migrate no-ops without DATABASE_URL)
env -u DATABASE_URL npm run build

# Serve the production build
env -u DATABASE_URL npm start
# → http://localhost:3000
```

---

## 6. Collector smoke tests (no UI)

These call county collectors directly and print status + a sample row:

```bash
cd metro-tax-scan

# Default set: DeKalb, Henry, Fulton, Richmond, Camden
npm run smoke

# Include the large Cobb delinquent PDF parse
npm run smoke:cobb

# Any county IDs from the registry (slugs are lowercase)
npx tsx scripts/smoke-collectors.ts chatham gwinnett fulton
```

County IDs match the registry in `src/server/georgia/counties.ts` (e.g. `dekalb`, `cobb`, `jeff-davis`).

---

## 7. API usage (local)

With the dev server running, identity is simulated, so these work without extra headers:

### List / search counties

```bash
curl -s 'http://localhost:3000/api/counties?q=chat' | jq .
```

### Enable counties + optional override URL

```bash
curl -s -X PUT 'http://localhost:3000/api/counties' \
  -H 'content-type: application/json' \
  -d '{
    "enabledCounties": ["fulton", "henry", "cobb", "dekalb", "chatham"],
    "setOverride": {
      "countyId": "chatham",
      "scanUrls": ["https://tax.chathamcountyga.gov/TaxSaleList"]
    }
  }' | jq .
```

### Run a scan

```bash
# Scan currently enabled counties
curl -s -X POST 'http://localhost:3000/api/scan' \
  -H 'content-type: application/json' \
  -d '{"trigger":"manual"}' | jq .

# Scan only specific counties for this request
curl -s -X POST 'http://localhost:3000/api/scan' \
  -H 'content-type: application/json' \
  -d '{"trigger":"manual","counties":["chatham","richmond"]}' | jq .
```

### Status and opportunities

```bash
curl -s 'http://localhost:3000/api/status' | jq .

curl -s 'http://localhost:3000/api/opportunities?county=cobb&minAmount=5000&limit=20' | jq .
```

### Cron endpoint (daily automation)

Locally, set a secret for the process:

```bash
export CRON_SECRET='choose-a-long-random-string'
env -u DATABASE_URL CRON_SECRET="$CRON_SECRET" npm run dev
```

Then:

```bash
curl -s 'http://localhost:3000/api/cron' \
  -H "Authorization: Bearer $CRON_SECRET" | jq .

# Force a scan even if one ran within 20 hours
curl -s 'http://localhost:3000/api/cron?force=1' \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

On Cursor-hosted apps, bind `CRON_SECRET` in Cursor secrets and schedule the same `GET` against the published URL.

---

## 8. Environment variables

| Variable | Required locally? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | No | If set, uses Postgres. **Leave unset locally** so PGlite + `migrations/` apply in-process. |
| `DATABASE_URL_UNPOOLED` | No | Used only by `scripts/migrate.mjs` in hosted builds with a pooler. |
| `CRON_SECRET` | No | Protects `GET /api/cron`. Without it, cron returns 401. |
| `CURSOR_APP_ID` / `CURSOR_APP_IDENTITY_ISSUER` | No | Set automatically on Cursor hosting. Locally, simulated identity is used. |

Do **not** commit a `.env` file with real secrets. `.env*` is gitignored.

---

## 9. Project layout

```text
metro-tax-scan/
  cursor/                 # Cursor app identity helper (do not hand-edit identity.ts)
  migrations/             # SQL migrations (PGlite locally; Postgres when DATABASE_URL is set)
  scripts/
    migrate.mjs           # Hosted migrate after build
    smoke-collectors.ts   # CLI collector smoke tests
  src/
    app/                  # Next.js App Router pages + API routes
    components/           # Dashboard UI
    server/
      georgia/counties.ts # All 159 counties registry
      collectors/         # Specialized + generic collectors
      scan.ts             # Scan orchestration
      settings.ts         # Enabled counties + URL overrides
      db.ts               # Postgres / PGlite access
  package.json
  README.md               # This file
```

---

## 10. Troubleshooting

| Symptom | What to try |
| --- | --- |
| `EADDRINUSE` / port in use | `npm run dev -- --port 3456` or stop the other process on 3000 |
| Scan writes to the wrong database | Ensure `DATABASE_URL` is unset: `env -u DATABASE_URL npm run dev` |
| Cron returns `401` | Export `CRON_SECRET` and send `Authorization: Bearer …` |
| County returns `skipped` | No URL on file — add a listing URL in the UI and save |
| County returns `empty` / sale notice only | Many counties post scanned PDFs or legal-organ ads only; open the linked official source |
| Cobb scan is slow | Expected — large monthly delinquent PDF; top opportunities by amount are stored |
| `pdf-parse` / PDF errors | Re-run `npm install`; collectors import `pdf-parse/lib/pdf-parse.js` to avoid the package debug harness |
| Module / build errors after pull | `rm -rf node_modules .next && npm install && env -u DATABASE_URL npm run build` |
| Lint | `npm run lint` |

---

## 11. Selecting counties (summary)

**UI:** search → enable → optional custom URL → **Run scan now**.

**API:**

- `GET /api/counties?q=`
- `PUT /api/counties` with `{ enabledCounties, setOverride }`
- `POST /api/scan` with optional `{ counties: ["chatham", "richmond"] }`

Default enabled set on a fresh local database: **Fulton, Henry, Cobb, DeKalb** (Metro Atlanta).
