# Ken Content Business

Build a minimalist internal operating system for a solo content creator
called "CreatorOS". It is a private web app for one user (me), not a public
SaaS. It should feel like Linear meets Notion: fast, calm, keyboard-friendly,
and never cluttered.

## PRODUCT GOAL
One place to run my content business: plan and ship videos across multiple
platforms, track brand deals, and see what is working so I can make better
content and more money.

## TECH STACK
- React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Lucide icons
- Supabase (Postgres + Auth) for data; row-level security on every table
- Recharts for charts, dnd-kit for drag-and-drop, date-fns for dates
- TanStack Query for data fetching, Zustand for UI state

choose stack best for this and you can build good system with. its internal tool for me.



## DESIGN SYSTEM
- Minimal, lots of whitespace, one accent color (indigo), neutral grays
- Light and dark mode (follow system, with a toggle)
- Font: Inter. Rounded-lg corners, subtle borders instead of heavy shadows
- Left sidebar (collapsible) + top bar with global search and "+ New" button
- Command palette (Cmd/Ctrl+K) to jump anywhere and create anything
- Every list has an empty state, a loading skeleton, and inline editing
- Fully responsive; mobile gets a bottom tab bar
- Keyboard shortcuts: N = new item, / = search, G then D/P/C/I/B = go to
  Dashboard/Pipeline/Calendar/Ideas/Brand deals

## MODULES

### 1. Dashboard (home)
- "Today" panel: what is due today, what is scheduled to publish, deals
  needing follow-up
- Weekly snapshot: videos published, total views, subscriber/follower change,
  revenue this month
- Pipeline health: count of items per stage
- Quick-capture box: type an idea and press Enter to save it

### 2. Content Pipeline (Kanban + table view toggle)
- Stages: Idea → Researching → Scripting → Filming → Editing → Scheduled →
  Published
- Each card: title, platform badges, due date, format (long video, Short,
  Reel, TikTok, carousel), priority, checklist progress
- Drag cards between stages; filter by account, platform, format, tag
- Card detail drawer: script link, thumbnail concepts, title options, notes,
  checklist (script, record, edit, thumbnail, upload), linked brand deal
- "Repurpose" button: one video spawns linked cards for Shorts/Reels/TikTok

### 3. Content Calendar
- Month / week / agenda views, color-coded by platform
- Drag to reschedule; shows both planned and published items
- Gaps highlighted ("No video scheduled for Thursday")
- Brand deal deadlines appear on the same calendar

### 4. Idea Bank
- Fast capture with title, short note, tags, source (comment, competitor,
  trend, own thought), and a score
- Auto score = potential reach x ease x relevance to my niche (each 1-5,
  editable)
- Sort by score; "Promote to pipeline" button
- Status: new, shortlisted, used, archived
- Optional AI helper (Anthropic API): expand an idea into 5 titles, 3 hooks,
  and an outline

### 5. Brand Deal CRM
- Pipeline: Lead → Contacted → Negotiating → Contract Sent → Active →
  Delivered → Paid (plus Lost)
- Fields: brand, contact name and email, deal value, currency, deliverables,
  platforms, deadline, usage rights, payment status, invoice due date
- Activity timeline per deal (emails, calls, notes) and follow-up reminders
- Link a deal to the pipeline videos that fulfill it
- Totals: pipeline value, confirmed revenue, outstanding payments

### 6. Accounts Hub
- Add multiple accounts per platform (YouTube channels, TikTok, Instagram,
  X, LinkedIn)
- Per account: name, handle, URL, niche, posting goal (e.g. 2 videos/week),
  current followers, notes, brand colors
- Account switcher in the sidebar so I can view everything for one account or
  all combined
- Manual stat entry first, with a clean structure ready for API sync later

### 7. Analytics & Projections
- Per-video table: views, watch time or retention, CTR, likes, comments,
  revenue, platform, publish date
- Charts: views over time, best formats, best topics, posting-day performance
- Projection: based on my last 8 to 12 videos, forecast next month's views
  and revenue, with a simple range (low / expected / high) and a plain-language
  note on assumptions
- "What worked" insights: top 3 patterns (topic, length, day, title style)

### 8. Revenue Tracker
- Income sources: brand deals, AdSense, affiliates, products, other
- Monthly chart, expenses, simple profit view, goal progress bar

### 9. Integrations (Settings page)
- Notion: link a Notion page or database to a pipeline card; sync title and
  status both ways
- Google Docs: attach script docs to a card, with a button to create a new
  Google Doc from a template and link it back
- Google Calendar: optional one-way push of scheduled posts
- Build these as an integrations layer with clear adapter interfaces and
  mark each one "Connect" with OAuth stubs. Wire up the data model first,
  and do not block the rest of the app on them.

## DATA MODEL (Postgres)
accounts, content_items, content_checklist_items, ideas, brand_deals,
deal_activities, deliverables (links deals to content_items), video_stats,
revenue_entries, tags, integrations. Add created_at and updated_at everywhere,
and use UUID primary keys.

## UX RULES
- Max 2 clicks to reach or create anything
- Optimistic updates, autosave (no "Save" buttons), undo toast on delete
- No modals for long forms: use right-side drawers
- Plain-language labels, no jargon
- Seed the app with realistic demo data so every screen looks alive on first
  load

## BUILD ORDER
Phase 1: Auth, layout, design system, Accounts Hub, Pipeline (Kanban)
Phase 2: Calendar, Idea Bank, Dashboard
Phase 3: Brand Deal CRM, Revenue Tracker
Phase 4: Analytics & Projections
Phase 5: Notion / Google Docs / Google Calendar integrations, AI helper

Start with Phase 1. Explain the plan briefly, then build it. After each phase,
stop and tell me what to test before moving on.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ken-content-business.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6ee83be6-bdf5-479e-8a2b-ec9af31140d8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
