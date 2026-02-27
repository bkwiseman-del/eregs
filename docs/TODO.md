# eRegs — Project TODO

## Done
- [x] Wire bookmark toggle button in TopNav
- [x] Multi-paragraph highlights (one row per selection, like notes)
- [x] Better highlights page with text content from regulation
- [x] Insights panel — real data from FMCSA guidance, YouTube videos, Trucksafe articles
- [x] Historical version browsing + inline diff view
- [x] Annotation impact detection and resolution flow
- [x] Incremental reg sync with version tracking and change detection
- [x] Mobile ActionBar positioning fix (above bottom nav)

## Core Features
- [ ] Search — TopNav input is non-functional, no backend
- [ ] Dashboard — "coming soon" placeholder
- [ ] FMCSA Guidance Scraper — replace manual spreadsheet with automated scraper of FMCSA Guidance Portal (~1,323 entries vs our ~603). See `memory/roadmap.md` for full plan.

## Infrastructure
- [ ] PWA / Offline Caching — service worker for offline regulation reading

## Fleet / Organization
- [ ] Fleet management pages (`/fleet`, drivers, tablets)
- [ ] Organization management UI (invite members, billing)
- [ ] Subscription/checkout flow (Stripe integration deferred)

## Auth / Account
- [ ] Forgot password flow (link exists, page 404s)
- [ ] Email verification
- [ ] Terms of Service page (`/terms` — 404)
- [ ] Privacy Policy page (`/privacy` — 404)
- [ ] User profile / account settings

## Polish
- [ ] Landing page for unauthenticated users (currently redirects to login)
- [ ] Pricing page
- [ ] Avatar shows real user initials (currently hardcoded "JD")
- [ ] Backend role-based access enforcement (API routes don't check `canAccessPro()`)
