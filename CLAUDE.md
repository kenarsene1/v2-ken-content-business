# CLAUDE.md

Guide for working in this repo. Read **AGENTS.md** too: it holds the binding architecture rules (one line + "Why" each). This file explains the map; AGENTS.md explains the rules. When they disagree, AGENTS.md wins.

## What this app is

**My content B/S CRM** (originally "CreatorOS"): a private, single-user operating system for a solo content creator. Plan videos across platforms, track brand deals and money, see what's working. Not a public SaaS.

- Built and still edited in **Lovable** (https://lovable.dev/projects/6ee83be6-bdf5-479e-8a2b-ec9af31140d8). Live at https://ken-content-business.lovable.app.
- GitHub `main` syncs both ways with Lovable. Every push shows up in the Lovable editor.
- `README.md` is the original product brief; `roadmap.md` tracks what is done and what is left (Phase 2 dashboard, Phase 4 analytics, Phase 5 integrations).

## Ground rules (Lovable-connected repo)

- **Never rewrite pushed history**: no force-push, rebase, amend or squash of pushed commits. Lovable loses project history.
- **Keep `main` working.** Anything pushed goes live in Lovable's editor.
- **Use Bun, not npm.** The lockfile is `bun.lock`. Don't create `package-lock.json`. Bun is at `~/.bun/bin/bun.exe` on this machine.
- `bunfig.toml` blocks package versions newer than 24h. Ask the user before adding exclusions.
- `git pull` before editing. The user also edits in Lovable.
- **Do not hand-edit generated files**: `src/routeTree.gen.ts` (rewritten on every dev start, so a diff there is normal), `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `src/integrations/lovable/index.ts`.
- **Do not add plugins to `vite.config.ts`.** `@lovable.dev/vite-tanstack-config` already includes React, Tailwind, TanStack Start, tsconfig paths, and nitro. Duplicates break the app.
- `.env` is committed and holds only the public Supabase URL and publishable key. Real secrets (AI keys, YouTube key) live in Lovable project Secrets, never in the repo or browser code.

## Commands

```bash
bun install        # install deps
bun run dev        # dev server on http://localhost:8080 (port fixed by Lovable config)
bun run build      # production build (Cloudflare target via nitro)
bun run test       # vitest (jsdom), tests in src/test/
bun run lint       # eslint
```

## Stack

| Layer | Tech |
| --- | --- |
| Framework | **TanStack Start** (React 19, SSR-capable) + **TanStack Router** (file-based) on Vite 8 |
| Language | TypeScript, very strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| UI | Tailwind CSS v4, shadcn/ui (new-york, Radix), Lucide icons, `motion`, sonner toasts, vaul, cmdk |
| Data | **Supabase** (Postgres + Auth + Storage), hosted by Lovable Cloud. RLS on every table |
| Server data | TanStack Query (all hooks in `src/lib/queries.ts`) |
| UI state | Zustand (`src/lib/store.ts`, persisted to localStorage key `creatoros-ui`) |
| Charts / DnD / dates | Recharts, dnd-kit, date-fns |
| AI | Vercel AI SDK (`ai`) with Anthropic / OpenAI / allowlisted OpenAI-compatible providers |
| Auth | Supabase email+password, plus Google via `@lovable.dev/cloud-auth-js` |
| Migrations | SQL files in `drizzle/migrations/` (drizzle-kit, run by Lovable). `drizzle/schema.ts` is empty |
| Tests | Vitest + Testing Library, jsdom |

Path alias: `@/` → `src/`.

## Folder map

```
src/
  routes/                 File-based routes (see src/routes/README.md for conventions)
    __root.tsx            HTML shell, fonts, theme pre-script, QueryClientProvider, auth listener
    index.tsx             "/" → redirects to /dashboard or /auth
    auth.tsx              Sign in / sign up / Google
    _authenticated/       Layout route: client-only (ssr:false), redirects to /auth if signed out,
      route.tsx             renders <AppShell/>
      dashboard.tsx       Today, monthly stats, pipeline health, quick idea capture
      pipeline.index.tsx  "Working on": focus workspace for one video (workflow in lib/workflow.ts)
      pipeline.board.tsx  "Pipeline": Kanban (dnd-kit) + table view of content_items
      calendar.tsx        Month/week/agenda, derived from content dates (lib/calendar.ts)
      ideas.tsx           "Video ideas": idea bank, scoring, "Send to Working on"
      deals.tsx           Brand deal CRM, groups (?group= URL param), analytics
      revenue.tsx         "Money": income/expenses, monthly chart
      analytics.tsx       YouTube analytics per profile (live API, not stored)
      accounts.tsx        Old URL → redirects to /settings/profiles
      settings.*.tsx      Profiles, account, appearance, backup/export, shortcuts
    api/assistant.ts      POST streaming endpoint for the AI assistant
  components/
    app-shell.tsx         Sidebar, top bar, mobile tab bar, profile switcher, global drawers,
                          keyboard shortcuts, lazy assistant panel
    *-drawer.tsx          Right-side Sheets for editing content/idea/deal/revenue/account (autosave)
    bits.tsx              Small shared pieces: AutoInput (autosave field), Field, EmptyState,
                          PlatformDot/Badge, Kbd
    more-apps.tsx         Shared "More" launcher for secondary nav (desktop + mobile)
    command-palette.tsx   Ctrl/Cmd+K
    sign-out-button.tsx   The only sign-out entry point (with confirm)
    profile-avatar.tsx    Renders private profile photos via signed URLs
    ai-elements/          Chat UI building blocks for the assistant
    ui/                   shadcn primitives (generated; restyle via tokens, not per-page)
  lib/
    queries.ts            ★ All Supabase reads/writes as TanStack Query hooks
    store.ts              ★ Zustand UI state (selected profile, theme, open drawers, views)
    platforms.ts          ★ Platform registry (the only place platforms are defined)
    constants.ts          Pipeline stages, formats, priorities, repurpose targets
    calendar.ts           Derives calendar events from content fields
    deals.ts / revenue.ts Pure analytics + money math (deals-as-income logic)
    ideas.ts              scopeToAccount helper, idea scoring
    publication.ts        Publish-date patch helper (shared by pipeline/calendar)
    reminders.ts          Derived reminders from content + deal deadlines
    workspace-data*.ts    Paginated full-workspace read (backup + assistant), CSV export
    *.functions.ts        TanStack Start server functions (run on server, called from browser)
    *.server.ts           Server-only code (never imported by browser code)
    integrations/platform-sync.ts   Adapter interface for future follower/stat syncing
  integrations/
    supabase/             Generated client + types; auth-middleware.ts (requireSupabaseAuth)
    lovable/              Generated Lovable OAuth helper
  styles.css              ★ Design tokens (colors, radii, --platform-<id> colors), light/dark
  start.ts                Server middleware: error page, CSRF for server fns, attach Supabase auth
  server.ts               SSR entry wrapper that turns crashes into a friendly error page
  test/                   Vitest tests (pure logic + a few component flows)
drizzle/migrations/       Database history as SQL (tables, RLS, triggers, functions)
public/                   Favicons
```

## How things connect

### Request / page flow
1. `/` checks the Supabase session and redirects to `/dashboard` or `/auth`.
2. Every app page sits under `_authenticated/`, which runs **client-side only**, verifies the user, and renders `AppShell` → `<Outlet/>` (the page).
3. `AppShell` mounts the global drawers once (`ContentDrawer`, `IdeaDrawer`, `DealDrawer`, `RevenueDrawer`, `AccountDrawer`, `AddProfileDialog`). Pages open them by setting an id in the Zustand store (`openContent(id)`, `openDeal(id)`, …).
4. `__root.tsx` listens for auth changes and invalidates the router and all queries.

### Data flow
- **Browser → Supabase directly.** Pages call hooks from `lib/queries.ts`, which use the browser Supabase client. Security comes from Postgres **RLS** (`user_id = auth.uid()`) on every table, not from app code.
- Mutations do optimistic cache updates. Deletes go through `useDeleteWithUndo` (undo toast). Several mutations call `refreshAll()` because deletes cascade across tables.
- **Profile scoping:** the sidebar profile switcher sets `useUI().accountId` (`null` = all profiles). Pages must read through the scoped hooks (`useScopedContent`, `useScopedIdeas`, `useScopedDeals`, `useScopedMoney`) so one profile never shows another's rows. Pickers use `useActiveAccounts()` (hides archived).
- **Server functions** (`*.functions.ts`, `createServerFn` + `requireSupabaseAuth` middleware) handle anything that needs secrets or outbound fetches: YouTube analytics (`YOUTUBE_API_KEY`), profile-photo import (host-allowlisted, redirects re-validated), backup export, assistant identity.
- **AI assistant:** `assistant-panel.tsx` (lazy) → `POST /api/assistant` with the user's bearer token → `assistant.server.ts` verifies the user, reads the whole workspace through RLS, builds a read-only snapshot, and streams a reply. Provider/model preference lives in the `ai_preferences` table; keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CUSTOM_AI_API_KEY`) are project Secrets. `ai-provider.server.ts` is the only place models are created.

### Database (Supabase / Postgres)
Tables (all with `user_id`, RLS, `created_at`/`updated_at`, UUID ids):

| Table | Purpose |
| --- | --- |
| `accounts` | Creator **profiles** (one per channel/handle): platform, handle, url, followers, posting goal, brand color, `avatar_path`, `archived_at` |
| `content_items` | Videos/posts in the pipeline: stage, format, platforms[], priority, due date, `publish_at`, `account_id`, `parent_id` (repurposed from) |
| `content_checklist_items` | Per-content checklist (default items added by trigger on insert) |
| `ideas` | Idea bank with reach/ease/relevance scores and status |
| `deal_groups` / `brand_deals` | Brand deal CRM, grouped. Deals can link to content and to a revenue entry |
| `revenue_entries` | Manual income/expenses |
| `quick_links`, `tags`, `ai_preferences` | Misc |

Notable database logic:
- `promote_idea(idea_id)`: atomic, duplicate-safe idea → content promotion.
- `delete_creator_profile(account_id, delete_linked)`: deletes a profile and either keeps or removes its content.
- Revenue ↔ brand deal sync triggers (migrations 0008/0009) mirror deal income into `revenue_entries` through a unique `revenue_entry_id`. Paid deals with no linked entry are counted as income in code (`dealsAsIncome`). **Never count deal money twice.**
- Signup demo-seeding triggers exist but are no-ops. New accounts start empty.
- Storage bucket `profile-pictures` (private, paths `userId/accountId/…`).

To change the schema, add a new numbered SQL migration in `drizzle/migrations/` (with RLS) and regenerate `types.ts` through Lovable. Don't edit old migrations.

## Conventions to follow

- **No Save buttons.** Long forms are right-side Sheets that autosave through `AutoInput`. No modals for long forms.
- **Styling** goes through semantic tokens in `src/styles.css` and the shared `ui/` primitives, not one-off colors per page.
- **Adding a platform** = one entry in `lib/platforms.ts` + one `--platform-<id>` color in `styles.css`. Nothing else.
- **Money**: keep currencies and profiles separate, with no exchange rates or invented numbers. Use helpers in `lib/revenue.ts` / `lib/deals.ts`.
- **Dates**: deadlines are date-only (local). Publish times are timezone-aware ISO timestamps. Use `lib/publication.ts` when publishing.
- **Integrations** (Notion, Google, platform sync) go behind adapter interfaces and must never block core screens.
- Plain-language UI labels. Every list needs empty and loading states.
- Put pure logic in `lib/` and test it in `src/test/`.
- Server-only code goes in `*.server.ts` or inside server function handlers, never in files the browser imports.

## UI naming vs code naming

| User sees | Code / DB |
| --- | --- |
| Profiles | `accounts` table, `Account` type |
| Working on | `/pipeline`, `content_items` (board at `/pipeline/board`) |
| Money | `/revenue`, `revenue_entries` |
| Send to pipeline | `promote_idea` |
