# eRegs — Digital Federal Motor Carrier Safety Regulations

Interactive digital platform for FMCSA regulations (Title 49 CFR Parts 40, 376, 380–399). Replaces physical regulation books with a searchable, responsive web interface.

**Live:** https://eregs-hpvu.vercel.app

## Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL on Railway (via Prisma 7)
- **Auth:** NextAuth.js
- **Hosting:** Vercel
- **Data Source:** eCFR API (https://www.ecfr.gov)

## Architecture

Regulations are cached in the database rather than fetched live from eCFR. This eliminates API timeouts and provides instant page loads.

- `CachedSection` — parsed regulation content (JSON) + raw XML for each section
- `CachedPartToc` — table of contents for each part
- `CachedImage` — regulation diagram images (sourced from GovInfo bulk data)

The 6-level paragraph hierarchy (`(a)(1)(i)(A)(1)(i)`) is detected automatically from the flat XML using a stateful label parser with predecessor tracking.

## Environment Variables

```
DATABASE_URL=postgresql://...          # Railway Postgres connection string
CRON_SECRET=eregs-sync-2026            # Auth for sync API endpoint
NEXTAUTH_SECRET=...                    # NextAuth session secret
NEXTAUTH_URL=https://eregs-hpvu.vercel.app
```

## Regulation Sync

Regulations are synced from the eCFR API and cached in the database. Run locally (Vercel times out on free tier):

### Full sync (fetches all sections from eCFR — takes ~10 min)

```bash
npx tsx scripts/sync-local.ts
```

### Re-parse only (re-processes cached XML without fetching — instant)

```bash
npx tsx scripts/sync-local.ts --reparse
```

### Sync images (requires downloading the GovInfo graphics ZIP first)

```bash
# 1. Download and extract Title 49 graphics
curl -L -o /tmp/ecfr-graphics.zip "https://www.govinfo.gov/bulkdata/ECFR/title-49/ECFR-title49-graphics.zip"
mkdir -p /tmp/ecfr-graphics
cd /tmp/ecfr-graphics && unzip /tmp/ecfr-graphics.zip

# 2. Load into database
cd ~/projects/eregs
npx tsx scripts/load-images.ts
```

### Vercel Cron (daily TOC sync only — sections are too large for free tier timeout)

Configured in `vercel.json` to run daily at 6am UTC. Syncs table of contents structure only.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/sync-local.ts` | Full regulation sync (run locally) |
| `scripts/sync-local.ts --reparse` | Re-parse cached XML with updated parser |
| `scripts/load-images.ts` | Load images from local GovInfo ZIP into DB |
| `scripts/sync-images.ts` | Attempt to fetch images from eCFR (blocked — use load-images instead) |
| `scripts/sync-all.sh` | Call Vercel sync API per-part (limited by timeout) |
| `scripts/check-xml.ts` | Debug: inspect cached XML for a section |
| `scripts/check-tables.ts` | Debug: check table parsing for cached sections |

## Development

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## eCFR API Reference

- **Structure:** `GET /api/versioner/v1/structure/{date}/title-49.json`
- **Content:** `GET /api/versioner/v1/full/{date}/title-49.xml?part=390&section=390.5`
- **Titles:** `GET /api/versioner/v1/titles` (use `up_to_date_as_of` for latest date)
- **Images:** Blocked via direct fetch. Use GovInfo bulk download: `https://www.govinfo.gov/bulkdata/ECFR/title-49/ECFR-title49-graphics.zip`
