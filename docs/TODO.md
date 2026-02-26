# eRegs — Project TODO

## Done
- [x] Wire bookmark toggle button in TopNav
- [x] Multi-paragraph highlights (one row per selection, like notes)
- [x] Better highlights page with text content from regulation

## Core Features
- [ ] Search — TopNav input is non-functional, no backend
- [ ] Insights panel — hardcoded mock data, no real content or API
- [ ] Dashboard — "coming soon" placeholder

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
