<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- App-wide presentation is defined through semantic tokens in src/styles.css and shared UI primitives; workspace selectors only handle page typography and spacing. Why: every feature inherits one visual system without changing its data or interactions.
- Secondary navigation is rendered by the shared MoreApps popover in desktop and mobile shells; keep existing destination routes and shortcuts. Why: one launcher keeps navigation consistent without duplicating page logic.
- All sign-out entry points use the shared SignOutButton confirmation. Why: cancellation must preserve the session and cached data consistently.
- Reject outdated Vite dependency requests and pre-optimize shared interactive libraries; keep the template's React deduplication. Why: an open preview must not mix React generations and crash every hook.
- Data access uses the browser Supabase client with TanStack Query hooks in `src/lib/queries.ts`; RLS (user_id = auth.uid()) protects every table. External photo fetching uses an authenticated server function with host validation. Why: private data stays owner-scoped and outbound image fetching needs a safe boundary.
- UI-only state (account filter, theme, open drawers, view mode) lives in the Zustand store `src/lib/store.ts`. Why: keeps server data and UI state separate.
- Profile reads clear unavailable persisted selections; all profile-linked creation mutations validate the current owner-visible active profile before inserting. Why: deleted, archived, or another login's profile must not cause foreign-key errors or silently reassign records.
- Long forms are right-side Sheets that autosave via `AutoInput`; deletes go through `useDeleteWithUndo`. Why: product rule of no save buttons and undoable deletes.
- New accounts start empty: signup triggers are no-ops and demo seed functions are unused. Why: the app holds only real creator data.
- Third-party integrations (Notion, Google, stat syncing via `PlatformSyncAdapter` in `src/lib/integrations/platform-sync.ts`) sit behind adapter interfaces, write only to the account they sync, and never block core modules. Why: integrations stay pluggable.
- Platforms are defined only in `src/lib/platforms.ts` (registry, link detection, grouping) plus a `--platform-<id>` color in `src/styles.css`. Why: adding a platform is a one-entry change.
- Pages read content through `useScopedContent()` so a selected profile only shows its own rows (`account_id`). Why: profile data must never leak across profiles.
- Profiles are managed only under /settings/profiles; archived profiles (archived_at set) are hidden from pickers via `useActiveAccounts()`, and deletes go through `DeleteProfileDialog` so linked content is explicitly kept or removed. Why: no silent data loss.
- The calendar derives publishing and deadline events from existing content fields through `src/lib/calendar.ts` and edits with shared content mutations; keep date-only deadlines local, publishing timestamps timezone-aware, and momentum based only on real published content and posting goals. Why: one source of truth for calendar, pipeline and editor, and motivation reflects actual progress.
- Ideas use `useScopedIdeas()` and shared account scoping; capture writes only to ideas, and explicit promotion uses the atomic security-invoker `promote_idea` function. Why: pipeline planning is opt-in, preserves the profile, and repeated promotions cannot create duplicate content.
- Profile photos live in owner-scoped private Storage paths and render through `ProfileAvatar` with cached signed URLs; public-platform import is bounded and host-allowlisted. Why: photos stay private, cannot expire in persisted rows, and platform failures never prevent manual uploads.
- Brand deals live in `brand_deals` + `deal_groups`; analytics are pure functions in `src/lib/deals.ts`, pages read via `useScopedDeals()`, and the selected group is a `?group=` URL param. Why: one source of truth, profile-scoped, shareable/testable views.
- Money: manual entries live in `revenue_entries`; owner-scoped security-invoker triggers atomically mirror brand-deal income into `brand_deals` via a unique `revenue_entry_id`. Linked edits/deletes synchronize both directions; `dealsAsIncome` derives only unlinked paid deals; totals keep currencies and profiles separate. Why: connected CRM records without duplicate payments, invented units or exchange rates.
- Publishing uses the shared publication helper for optimistic and persisted dates; dashboard counts only actually published items in the local current month. Why: cache updates must never prevent the publish timestamp from being saved.
- All AI features use authenticated functions and the shared server-only provider factory; credentials are project Secrets, while per-user provider/model preferences use RLS in `ai_preferences`. Custom endpoints are allowlisted and redirects rejected. Why: credentials never reach the browser and provider requests cannot target arbitrary internal services.
- Backup and assistant reads share the paginated owner-scoped workspace-data inventory. Why: preserve all records and relationships beyond row limits.
- Lazy-loaded assistant streams via a bearer-verified server route; reminders derive from content/deals. Why: fast normal pages and no duplicate task data.
- Library items live in `library_items` grouped by `library_projects` (removing a project keeps its items), uploads go to the private `library` bucket under the owner's id, ideas/videos carry `ref_url`, videos add `resources` and thumbnail fields, and board columns come from `workflows.stages` (empty = built-in stages). Why: references, uploads and layouts stay owner-scoped with one source of truth.
- Drag-and-drop lists register dnd-kit mouse, touch and keyboard sensors with `pointerWithin` collision detection, and reorder writes take their "what changed" snapshot from before the optimistic cache update. Why: `PointerSensor` reports no drop target, and the cache already looks correct by the time the write runs, so either mistake silently saves nothing.
