import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { autoTitle, CHALLENGE_KINDS, CHALLENGE_PERIODS, type Challenge } from "@/lib/challenges";
import { FORMATS } from "@/lib/constants";
import { useAccounts, useChallenges, useDeleteWithUndo, useUpdateChallenge } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { AutoInput, Field } from "./bits";
import { ProfileAvatar } from "./profile-avatar";

type Patch = Partial<Pick<Challenge, "title" | "kind" | "period" | "target" | "format" | "account_id" | "archived_at">>;

const clampTarget = (raw: string, fallback: number) => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : fallback;
};

export function ChallengeDrawer() {
  const { openChallengeId, openChallenge } = useUI();
  const { data: challenges } = useChallenges();
  const { data: accounts } = useAccounts();
  const update = useUpdateChallenge();
  const del = useDeleteWithUndo();
  const c = challenges?.find((x) => x.id === openChallengeId);

  /** Saves a change; a title that still matches its settings follows them. */
  const save = (patch: Patch) => {
    if (!c) return;
    const next = { ...c, ...patch };
    const followsSettings = c.title === autoTitle(c) && patch.title === undefined && next.kind !== "manual";
    update.mutate({ id: c.id, patch: followsSettings ? { ...patch, title: autoTitle(next) } : patch });
  };
  const kind = CHALLENGE_KINDS.find((k) => k.id === c?.kind);

  return (
    <Sheet open={!!openChallengeId} onOpenChange={(open) => !open && openChallenge(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="sr-only">Challenge</SheetTitle>
        {c && (
          <div className="space-y-6 pb-10">
            <div className="pr-8">
              <p className="mb-3 text-xs font-medium text-primary">Challenge</p>
              <AutoInput key={c.id} value={c.title} className="-ml-2 text-xl font-semibold" onSave={(title) => save({ title: title.trim() || autoTitle({ ...c, title: "New challenge" }) })} />
              <p className="text-xs text-muted-foreground">Changes save automatically</p>
            </div>

            <div className="space-y-1">
              <Field label="Type">
                <Select value={c.kind} onValueChange={(v) => save({ kind: v, format: v === "publish" ? c.format : null })}>
                  <SelectTrigger aria-label="Challenge type" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHALLENGE_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Repeats">
                <Select value={c.period} onValueChange={(period) => save({ period })}>
                  <SelectTrigger aria-label="Challenge period" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHALLENGE_PERIODS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={c.kind === "time_limit" ? "Hours per video" : "Goal"}>
                <AutoInput type="number" aria-label="Challenge goal" value={String(c.target)} onSave={(v) => save({ target: clampTarget(v, c.target) })} />
              </Field>
              {c.kind === "publish" && (
                <Field label="Format">
                  <Select value={c.format ?? "any"} onValueChange={(v) => save({ format: v === "any" ? null : v })}>
                    <SelectTrigger aria-label="Challenge format" className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any format</SelectItem>
                      {FORMATS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Profile">
                <Select value={c.account_id ?? "all"} onValueChange={(v) => save({ account_id: v === "all" ? null : v })}>
                  <SelectTrigger aria-label="Challenge profile" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All profiles</SelectItem>
                    {accounts?.filter((a) => !a.archived_at || a.id === c.account_id).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2"><ProfileAvatar account={a} className="h-5 w-5" />{a.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {kind && <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">{kind.hint}</p>}

            <div className="flex flex-wrap gap-2 border-t pt-5">
              <Button variant="outline" className="gap-1.5" onClick={() => save({ archived_at: c.archived_at ? null : new Date().toISOString() })}>
                {c.archived_at ? <><ArchiveRestore className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}
              </Button>
              <Button
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  openChallenge(null);
                  del("challenges", c, c.title);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
