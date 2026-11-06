import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoalCard, GoalKindIcon } from "@/components/goal-card";
import { ChallengesPanel } from "@/components/challenges-panel";
import { ProfileAvatar } from "@/components/profile-avatar";
import { GOAL_DEFAULTS, GOAL_KINDS, sortGoals, type Goal, type GoalKind } from "@/lib/goals";
import { useAccounts, useContent, useCreateGoal, useScopedGoals, type Account } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals")({
  validateSearch: (search: Record<string, unknown>): { view?: "challenges" } => (search["view"] === "challenges" ? { view: "challenges" } : {}),
  head: () => ({
    meta: [
      { title: "Goals & plans · My content B/S CRM" },
      { name: "description", content: "Goals, plans and projects for each of your channels, with flexible progress tracking." },
      { property: "og:title", content: "Goals & plans · My content B/S CRM" },
      { property: "og:description", content: "Goals, plans and projects for each of your channels, with flexible progress tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GoalsPage,
});

type Tab = "all" | GoalKind | "done" | "challenges";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  ...GOAL_KINDS.map((k) => ({ id: k.id, label: k.plural })),
  { id: "done", label: "Done" },
];

const inTab = (g: Goal, tab: Tab) => (tab === "done" ? g.status === "done" : g.status !== "done" && (tab === "all" || g.kind === tab));

/** One section per channel, plus "No channel"; only when viewing all accounts. */
function byChannel(goals: Goal[], accounts: Account[]) {
  const groups = accounts
    .map((account) => ({ key: account.id, account, goals: goals.filter((g) => g.account_id === account.id) }))
    .filter((group) => group.goals.length > 0);
  const known = new Set(accounts.map((a) => a.id));
  const loose = goals.filter((g) => !g.account_id || !known.has(g.account_id));
  return loose.length ? [...groups, { key: "none", account: undefined, goals: loose }] : groups;
}

function GoalsPage() {
  const { data: content } = useContent();
  const { accountId, openGoal } = useUI();
  const { data: accounts } = useAccounts();
  const { data: goals, isLoading, error, refetch } = useScopedGoals();
  const create = useCreateGoal();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [tab, setTabState] = useState<Tab>(view === "challenges" ? "challenges" : "all");
  // Keep ?view=challenges in the URL so the header New button and links know where you are.
  const setTab = (next: Tab) => {
    setTabState(next);
    void navigate({ search: next === "challenges" ? { view: "challenges" } : {}, replace: true });
  };

  const profile = accounts?.find((a) => a.id === accountId);
  const all = goals ?? [];
  const shown = sortGoals(all.filter((g) => inTab(g, tab)));
  const groups = accountId ? [{ key: accountId, account: profile, goals: shown }] : byChannel(shown, accounts ?? []);
  const activeCount = all.filter((g) => g.status === "active").length;
  const doneCount = all.filter((g) => g.status === "done").length;
  const channelOf = (g: Goal) => accounts?.find((a) => a.id === g.account_id);

  const add = async (kind: GoalKind) => {
    const row = await create.mutateAsync({ ...GOAL_DEFAULTS[kind], account_id: accountId });
    if (tab === "done" || (tab !== "all" && tab !== kind)) setTab("all");
    openGoal(row.id);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 calendar-enter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          {profile ? <><ProfileAvatar account={profile} className="h-4 w-4" />{profile.name}</> : <><Target className="h-3.5 w-3.5" />All accounts</>}
        </div>
        <h1 className="page-title">Goals & plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {all.length ? `${activeCount} active · ${doneCount} done` : "Where your channels are heading, and how you'll get there."}
        </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={tab === "challenges"}
          onClick={() => setTab(tab === "challenges" ? "all" : "challenges")}
          className={cn(
            "h-8 gap-1.5 rounded-full px-3.5 text-xs font-medium",
            tab === "challenges" ? "border-0 bg-gradient-to-r from-quest to-quest-2 text-quest-foreground shadow-sm hover:text-quest-foreground hover:opacity-90" : "border-quest/40 text-quest hover:bg-quest-soft hover:text-quest",
          )}
        >
          <Trophy className="h-3.5 w-3.5" /> Challenges
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="h-7 gap-1.5 px-2.5 text-xs data-[state=active]:bg-muted data-[state=active]:shadow-none">
                {t.label}
                <span className="tabular-nums text-muted-foreground">{all.filter((g) => inTab(g, t.id)).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab !== "challenges" && <div className="flex gap-1.5">
          {GOAL_KINDS.map((k) => (
            <Button key={k.id} variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs" disabled={create.isPending} onClick={() => void add(k.id)}>
              <Plus className="h-3 w-3" /> {k.label}
            </Button>
          ))}
        </div>}
      </div>

      {tab === "challenges" ? (
        <ChallengesPanel />
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Goals couldn't load.</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center">
          <Target className="mb-3 h-6 w-6 text-primary/60" />
          <p className="text-sm font-medium">{tab === "done" ? "Nothing finished yet" : "No goals here yet"}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {tab === "done" ? "Goals you mark done will rest here." : "Write down a goal, a plan or a project for a channel. Track it with a number, a percentage, steps, or not at all."}
          </p>
          {tab !== "done" && (
            <div className="mt-4 flex gap-1.5">
              {GOAL_KINDS.map((k) => (
                <Button key={k.id} variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs" disabled={create.isPending} onClick={() => void add(k.id)}>
                  <GoalKindIcon kind={k.id} className="h-3 w-3" /> {k.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              {!accountId && (
                <h2 className="mb-2.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  {group.account ? <><ProfileAvatar account={group.account} className="h-4 w-4" />{group.account.name}</> : "No channel"}
                  <span className="tabular-nums">· {group.goals.length}</span>
                </h2>
              )}
              <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.goals.map((g) => (
                  <GoalCard key={g.id} goal={g} channel={channelOf(g)} videos={content} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
