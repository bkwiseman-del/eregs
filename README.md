# eRegs

A digital platform that modernizes Federal Motor Carrier Safety Regulations (FMCSRs) by replacing traditional printed regulation books with an interactive reader. Built for fleet administrators and drivers in the trucking industry.

## What It Does

- **Regulation Reader** — Browse all FMCSR Parts (40–399) with structured, navigable content parsed from the eCFR XML API
- **Annotations** — Tap paragraphs to highlight, add notes, or copy text with CFR citations. Local-first (works without auth, persists with auth).
- **Insights Panel** — Contextual FMCSA guidance, Trucksafe videos, and articles alongside regulation text
- **Appendixes** — Full support for regulatory appendixes (e.g., Appendix A to Part 385)
- **Version History** — Track regulatory changes with Federal Register citations
- **Responsive** — Desktop layout with resizable/collapsible sidebars; mobile layout with bottom tabs and drawer navigation

## Tech Stack

- **Next.js 16** (App Router, React 19)
- **PostgreSQL** + **Prisma ORM** (Neon-compatible)
- **NextAuth v5** (email magic link via Resend, SMS via Twilio)
- **eCFR API** — Fetches regulation structure and full XML content from ecfr.gov
- **Vercel** for deployment

## Project Structure

```
src/
├── app/
│   ├── regs/[section]/     # Dynamic reader route (e.g., /regs/390.5)
│   ├── api/
│   │   ├── reader-data/    # Serves cached TOC + sections to the client
│   │   ├── annotations/    # CRUD for highlights and notes
│   │   ├── cron/sync-regs/ # Cron endpoint to sync eCFR data
│   │   └── ecfr-image/     # Proxy for eCFR regulation images
│   ├── (auth)/             # Login / verify pages
│   └── (dashboard)/        # Dashboard (post-auth)
├── components/reader/
│   ├── ReaderShell.tsx      # Main orchestrator: state, navigation, annotations
│   ├── ReaderContent.tsx    # Renders paragraphs, tables, images with annotation state
│   ├── ReaderSidebar.tsx    # TOC sidebar (all FMCSR parts, expandable subparts)
│   ├── InsightsPanel.tsx    # Guidance, videos, articles panel
│   ├── ActionBar.tsx        # Selection actions: highlight, note, copy (inline note editor)
│   ├── TopNav.tsx           # Navigation bar with search, TOC toggle, insights toggle
│   ├── NavRail.tsx          # Left icon rail (desktop)
│   ├── ResizeHandle.tsx     # Draggable panel border for resizing sidebars
│   └── Toast.tsx            # Feedback notifications
├── lib/
│   ├── ecfr/index.ts        # eCFR API client, XML parser, caching, sync logic
│   ├── annotations.ts       # Annotation types and paragraph ID helpers
│   ├── auth/                # NextAuth configuration
│   └── db/                  # Prisma client
scripts/
├── sync-local.ts            # Local dev: sync all regulation data
├── sync-all.sh              # Batch sync script
└── sync-images.ts           # Sync regulation images
```

## Setup

```bash
# Install
npm install

# Environment variables
cp .env.example .env
# Required:
#   DATABASE_URL          — PostgreSQL connection string
#   AUTH_SECRET            — NextAuth secret (openssl rand -base64 32)
#   RESEND_API_KEY         — For email magic links
#   AUTH_RESEND_FROM       — Sender email address
# Optional:
#   TWILIO_ACCOUNT_SID     — For SMS auth
#   TWILIO_AUTH_TOKEN
#   TWILIO_PHONE_NUMBER

# Database
npx prisma migrate deploy
npx prisma generate

# Sync regulation data (first run — fetches all FMCSR parts from eCFR)
npx tsx scripts/sync-local.ts

# Run
npm run dev
```

Open [http://localhost:3000/regs/390.5](http://localhost:3000/regs/390.5) to see the reader.

## Data Pipeline

Regulation content flows from the eCFR API into a local PostgreSQL cache:

1. **Structure sync** — Fetches the Title 49 structure tree, extracts part/subpart/section/appendix hierarchy, stores as `CachedPartToc` rows
2. **Content sync** — For each section, fetches XML from the eCFR versioner API, parses into structured `EcfrNode[]` (paragraphs, tables, images), stores as `CachedSection` rows
3. **Reader delivery** — The `/api/reader-data?part=390` endpoint serves an entire part's TOC + sections in one call. The client caches in-memory for instant cross-section navigation.

Appendixes use a different eCFR endpoint (`&appendix=...` vs `&section=...`) and are identified by slugs like `385-appA`.

## Key Design Decisions

- **Paragraph as annotation unit** — Stable structural identifiers, robust to regulation updates, no fragile text offsets
- **Local-first annotations** — UI updates immediately on tap, API sync happens in background. Works without authentication.
- **Single-page reader** — Client-side navigation between sections within a part. Full parts loaded in one API call and cached in a global in-memory store.
- **Resizable panels** — TOC (200–420px) and Insights (240–440px) panels have drag handles. TOC is collapsible to a 28px tab.

## Monetization

- $4 per driver invite (personal device)
- $4 per tablet registration (shared fleet device)
