import { useState } from "react";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { autoTitle, CHALLENGE_TEMPLATES, challengeFromTemplate, DEFAULT_CHALLENGE, sortChallenges, type ChallengeTemplate } from "@/lib/challenges";
import { isMissingTableError, useChallengeRows, useCreateChallenge } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { ChallengeCard } from "./challenge-card";
import { ChallengesSetupNotice } from "./challenges-section";

/** Challenges inside Goals & plans: quick-start templates, then the challenge cards. */
export function ChallengesPanel() {
  const { accountId, openChallenge } = useUI();
  const { rows, isLoading, error, refetch } = useChallengeRows();
  const create = useCreateChallenge();
  const [tab, setTab] = useState<"active" | "archived">("active");

  const active = (rows ?? []).filter((r) => !r.challenge.archived_at);
  const archived = (rows ?? []).filter((r) => r.challenge.archived_at);
  const shown = sortChallenges(tab === "active" ? active : archived);

  const add = async (template: ChallengeTemplate, open = false) => {
    const row = await create.mutateAsync(challengeFromTemplate(template, accountId));
    setTab("active");
    if (open) openChallenge(row.id);
  };

  if (isMissingTableError(error)) return <ChallengesSetupNotice />;
  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Challenges couldn't load.</p>
        <Button variant="ghost" onClick={refetch}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-label="Start a challenge" className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <h2 className="shrink-0 pr-1 text-xs text-muted-foreground">Start a challenge</h2>
        <div className="flex shrink-0 flex-nowrap gap-1.5">
          {CHALLENGE_TEMPLATES.map((t) => {
            const title = t.title ?? autoTitle({ ...t, title: "" });
            return (
              <Button key={title} variant="outline" size="sm" className="h-7 shrink-0 gap-1 rounded-full bg-card px-2.5 text-xs font-normal shadow-xs" disabled={create.isPending} onClick={() => void add(t)}>
                <Plus className="h-3 w-3 text-primary" /> {title}
                <span className="text-muted-foreground">· {t.period === "month" ? "monthly" : "weekly"}</span>
              </Button>
            );
          })}
          <Button size="sm" className="h-7 shrink-0 gap-1 rounded-full px-2.5 text-xs shadow-sm" disabled={create.isPending} onClick={() => void add(DEFAULT_CHALLENGE, true)}>
            <Plus className="h-3 w-3" /> Custom
          </Button>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v === "archived" ? "archived" : "active")}>
        <TabsList className="h-auto bg-transparent p-0">
          {([["active", "Active", active.length], ["archived", "Archived", archived.length]] as const).map(([id, label, count]) => (
            <TabsTrigger key={id} value={id} className="h-7 gap-1.5 px-2.5 text-xs data-[state=active]:bg-muted data-[state=active]:shadow-none">
              {label}
              <span className="tabular-nums text-muted-foreground">{count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading || !rows ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center">
          <Trophy className="mb-2 h-5 w-5 text-quest" />
          <h2 className="text-sm font-medium">{tab === "active" ? "No challenges yet" : "Nothing archived"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === "active" ? "Pick one above. It tracks itself as you publish." : "Archived challenges rest here."}
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((row) => <ChallengeCard key={row.challenge.id} {...row} />)}
        </div>
      )}
    </div>
  );
}
