import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays, ChevronsLeft, ChevronsRight, Handshake, Kanban, LayoutDashboard,
  Lightbulb, Plus, Search, Settings,
} from "lucide-react";
import { markDraft } from "@/lib/drafts";
import { useDraftCleanup, useActiveAccounts as useAccounts, useCreateContent, useCreateIdea, useCreateDeal, useCreateRevenue, useCreateChallenge, useCreateGoal, useCreateLibraryItem } from "@/lib/queries";
import { challengeFromTemplate, DEFAULT_CHALLENGE } from "@/lib/challenges";
import { ChallengeDrawer } from "./challenge-drawer";
import { GoalDrawer } from "./goal-drawer";
import { LibraryDrawer } from "./library-drawer";
import { GOAL_DEFAULTS } from "@/lib/goals";
import { ProfileAvatar } from './profile-avatar';
import { IdeaDrawer } from './idea-drawer';
import { DealDrawer } from './deal-drawer';
import { RevenueDrawer } from './revenue-drawer';
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommandPalette } from "./command-palette";
import { ContentDrawer } from "./content-drawer";
import { AccountDrawer } from "./account-drawer";
import { AddProfileDialog } from "./add-profile-dialog";
import { groupByPlatform } from "@/lib/platforms";
import { Kbd, PlatformDot } from "./bits";
import { MoreApps } from "./more-apps";

import { AssistantIcon, AssistantPopover } from "./assistant-popover";
import { useAssistantPopup } from "./use-assistant-popup";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "D" },
  { to: "/pipeline", label: "Working on", icon: Kanban, key: "P" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, key: "C" },
  { to: "/ideas", label: "Video ideas", icon: Lightbulb, key: "I", desktopOnly: true },
  { to: '/deals', label: 'Brand deals', icon: Handshake, key: 'B' },
] as const;

/** The mobile tab bar has no room for every page; the rest live under More. */
const MOBILE_NAV = NAV.filter((n) => !("desktopOnly" in n));

export function useNewContent() {
  const create = useCreateContent();
  const { accountId, openContent } = useUI();
  const { data: accounts } = useAccounts();
  return async (title = "Untitled", stage = "idea") => {
    const acc = accounts?.find((a) => a.id === accountId);
    const calendarDay = useUI.getState().calendarDate;
    const isCalendar = typeof window !== "undefined" && window.location.pathname === "/calendar";
    const planned = isCalendar ? new Date(`${calendarDay ?? new Date().toLocaleDateString("en-CA")}T12:00:00`) : null;
    const row = await create.mutateAsync({
      title,
      stage: planned ? "scheduled" : stage,
      publish_at: planned ? planned.toISOString() : null,
      account_id: accountId,
      platforms: acc ? [acc.platform] : [],
    });
    markDraft("content_items", row.id);
    openContent(row.id);
    return row;
  };
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const assistant = useAssistantPopup(path);
  const pageLabel = NAV.find((item) => path.startsWith(item.to))?.label ?? (path.startsWith("/settings") ? "Settings" : path.startsWith("/goals") ? "Goals & plans" : path.startsWith("/library") ? "Library" : path.startsWith("/revenue") ? "Money" : "Analytics");
  const { theme, setTheme, setPaletteOpen, accountId, setAccountId, openAccount } = useUI();
  const { data: accounts } = useAccounts();
  const newContent = useNewContent();
  const createIdea = useCreateIdea();
  const createDeal = useCreateDeal();
  const createRevenue = useCreateRevenue();
  const createChallenge = useCreateChallenge();
  const createGoal = useCreateGoal();
  const createLibraryItem = useCreateLibraryItem();

  useDraftCleanup();

  const gPressed = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && setTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, setTheme]);

  const onNew = async () => {
    if (path.startsWith("/settings/profiles")) {
      useUI.getState().setAddProfile({});
    } else if (path.startsWith('/ideas')) {
      const row = await createIdea.mutateAsync({ account_id: accountId });
      markDraft("ideas", row.id);
      useUI.getState().openIdea(row.id);
    } else if (path.startsWith('/deals')) {
      const groupId = new URLSearchParams(window.location.search).get('group');
      const row = await createDeal.mutateAsync({ account_id: accountId, group_id: groupId && groupId !== 'all' ? groupId : null });
      markDraft("brand_deals", row.id);
      useUI.getState().openDeal(row.id);
    } else if (path.startsWith('/revenue')) {
      const row = await createRevenue.mutateAsync({ account_id: accountId, kind: 'income', title: 'New income' });
      markDraft("revenue_entries", row.id);
      useUI.getState().openRevenue(row.id);
    } else if (path.startsWith("/goals") && new URLSearchParams(window.location.search).get("view") === "challenges") {
      const row = await createChallenge.mutateAsync(challengeFromTemplate(DEFAULT_CHALLENGE, accountId));
      useUI.getState().openChallenge(row.id);
    } else if (path.startsWith("/goals")) {
      const row = await createGoal.mutateAsync({ ...GOAL_DEFAULTS.goal, account_id: accountId });
      useUI.getState().openGoal(row.id);
    } else if (path.startsWith("/library")) {
      const id = crypto.randomUUID();
      createLibraryItem.mutate({ id, kind: "note", title: "Untitled note", account_id: accountId });
      useUI.getState().openLibraryItem(id);
    } else newContent();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (Date.now() - gPressed.current < 1000) {
        gPressed.current = 0;
        const map: Record<string, string> = { d: "/dashboard", p: "/pipeline", c: "/calendar", i: '/ideas', b: '/deals', r: '/revenue', h: '/challenges', o: '/goals', y: '/analytics', a: "/settings/profiles", s: "/settings" };
        if (map[k]) navigate({ to: map[k] });
        return;
      }
      if (k === "g") gPressed.current = Date.now();
      else if (k === "n") {
        e.preventDefault();
        onNew();
      } else if (k === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar transition-[width] duration-300 motion-reduce:transition-none md:flex",
          collapsed ? "w-18" : "w-60",
        )}
      >
        <div className="flex h-20 items-center gap-2.5 px-5">
          <img src="/favicon.png" alt="" className="h-7 w-7 shrink-0 rounded-lg" />
          {!collapsed && <span className="min-w-0 font-display text-base font-medium leading-snug">My content B/S CRM</span>}
        </div>

        {!collapsed && (
          <div className="px-3 pb-2">
            <Select value={accountId ?? "all"} onValueChange={(v) => setAccountId(v === "all" ? null : v)}>
              <SelectTrigger aria-label="Filter by profile" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {groupByPlatform(accounts ?? []).map((g) => (
                  <SelectGroup key={g.platform.id}>
                    <SelectLabel className="text-xs text-muted-foreground">{g.platform.label}</SelectLabel>
                    {g.items.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <ProfileAvatar account={a} className="h-5 w-5" /> {a.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {NAV.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                title={n.label}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                  active ? "bg-sidebar-accent font-medium text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{n.label}</span>
                    <span className="hidden text-[10px] text-muted-foreground group-hover:inline">G {n.key}</span>
                  </>
                )}
              </Link>
            );
          })}
          <MoreApps collapsed={collapsed} />
        </nav>

        <div className="space-y-1 border-t p-3">
          <Link
            to="/settings"
            title="Settings"
            className={cn(
              "flex h-10 w-full justify-start items-center gap-3 rounded-xl px-3 text-sm hover:bg-sidebar-accent hover:text-foreground",
              path.startsWith("/settings") ? "bg-sidebar-accent font-medium text-primary" : "text-muted-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            {!collapsed && <span>Settings</span>}
          </Link>
          <Button
            variant="ghost"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-10 w-full justify-start items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 grid h-20 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:flex md:px-8">
          <div className="hidden shrink-0 sm:flex md:hidden">
            <img src="/favicon.png" alt="" className="h-8 w-8 rounded-xl" />
          </div>
          <span className="hidden min-w-0 font-display text-sm font-medium md:block">{pageLabel}</span>
          <Button
            variant="ghost"
            aria-label="Search or jump to"
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 min-w-0 max-w-md flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-normal text-muted-foreground transition-colors hover:bg-muted sm:ml-auto"
          >
            <Search className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate text-left">Search or jump to…</span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>⌘K</Kbd>
            </span>
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Assistant and reminders" aria-expanded={assistant.open} title="Assistant and reminders" className={cn("shrink-0 text-primary [&_svg]:size-4", assistant.open && "bg-muted")} onClick={assistant.toggle}><AssistantIcon /></Button>
          {/* Brand deals has its own "New deal" button, so the shared one would be a duplicate there. */}
          {!path.startsWith("/deals") && (
            <Button size="sm" onClick={onNew} className="shrink-0 gap-1.5 px-4">
              <Plus className="h-4 w-4" /> New <span className="hidden opacity-70 sm:inline">N</span>
            </Button>
          )}
        </header>
        <main className="workspace min-w-0 flex-1 px-4 pb-28 pt-8 md:px-8 md:pb-12">
          <div className="mb-4 md:hidden"><Select value={accountId ?? 'all'} onValueChange={(v) => setAccountId(v === 'all' ? null : v)}><SelectTrigger aria-label="Filter by profile" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}><span className="flex items-center gap-2"><ProfileAvatar account={a} className="h-5 w-5" />{a.name}</span></SelectItem>)}</SelectContent></Select></div>
          <Outlet />
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {MOBILE_NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px]",
              path.startsWith(n.to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
        <MoreApps mobile />
        <Link
          to="/settings"
          className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px]", path.startsWith("/settings") ? "text-primary" : "text-muted-foreground")}
        >
          <Settings className="h-5 w-5" /> Settings
        </Link>
      </nav>

      <CommandPalette onNew={onNew} />
      <ContentDrawer />
      <AccountDrawer />
      <AddProfileDialog />
      <IdeaDrawer />
      <DealDrawer />
      <RevenueDrawer />
      <ChallengeDrawer />
      <GoalDrawer />
      <LibraryDrawer />
      {assistant.mounted && <AssistantPopover open={assistant.open} onMinimize={assistant.hide} />}
    </div>
  );
}

