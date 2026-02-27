# eRegs

A digital platform that modernizes Federal Motor Carrier Safety Regulations (FMCSRs) by replacing traditional printed regulation books with an interactive reader. Built for fleet administrators and drivers in the trucking industry.

## What It Does

- **Regulation Reader** — Browse all FMCSR Parts (40–399) with structured, navigable content parsed from the eCFR XML API
- **Annotations** — Tap paragraphs to highlight, add notes, or copy text with CFR citations. Local-first (works without auth, persists with auth).
- **Insights Panel** — Contextual FMCSA guidance, Trucksafe videos, and articles alongside regulation text
- **Pro Dashboard** — Content feed (YouTube videos, podcast episodes, blog articles) from Trucksafe, with inline video modal, inline podcast player, and activity sidebar showing recent annotations
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
│   │   ├── dashboard/      # Feed + activity APIs for Pro dashboard
│   │   ├── cron/sync-regs/ # Cron endpoint to sync eCFR data
│   │   ├── cron/sync-feed/ # Cron endpoint to sync YouTube/podcast/article feed
│   │   └── ecfr-image/     # Proxy for eCFR regulation images
│   ├── (auth)/             # Login / verify pages
│   └── (dashboard)/        # Pro dashboard (content feed + activity sidebar)
├── components/reader/
│   ├── ReaderShell.tsx      # Main orchestrator: state, navigation, annotations
│   ├── ReaderContent.tsx    # Renders paragraphs, tables, images with annotation state
│   ├── ReaderSidebar.tsx    # TOC sidebar (all FMCSR parts, expandable subparts)
│   ├── InsightsPanel.tsx    # Guidance, videos, articles panel
│   ├── ActionBar.tsx        # Selection actions: highlight, note, copy (inline note editor)
│   ├── TopNav.tsx           # Navigation bar (wraps shared AppNav with insights/bookmark)
│   ├── NavRail.tsx          # Left icon rail (desktop)
│   ├── ResizeHandle.tsx     # Draggable panel border for resizing sidebars
│   └── Toast.tsx            # Feedback notifications
├── components/dashboard/
│   └── DashboardShell.tsx   # Feed cards, video modal, podcast player, activity sidebar
├── components/shared/
│   ├── AppNav.tsx           # Shared top nav (logo, search, avatar) used across all pages
│   └── MobileBottomTabs.tsx # Mobile bottom tab bar
├── lib/
│   ├── ecfr/index.ts        # eCFR API client, XML parser, caching, sync logic
│   ├── annotations.ts       # Annotation types and paragraph ID helpers
│   ├── auth/                # NextAuth configuration
│   └── db/                  # Prisma client
scripts/
├── sync-local.ts            # Local dev: sync all regulation data
├── sync-feed.ts             # Sync YouTube playlist, podcast RSS, and blog articles into FeedItem table
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
#   YOUTUBE_API_KEY         — For syncing YouTube playlist feed
#   CRON_SECRET             — Bearer token for cron endpoints

# Database
npx prisma migrate deploy
npx prisma generate

# Sync regulation data (first run — fetches all FMCSR parts from eCFR)
npx tsx scripts/sync-local.ts

# Sync dashboard content feed (YouTube, podcast, articles)
npx tsx scripts/sync-feed.ts

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
