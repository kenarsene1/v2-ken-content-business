import { useEffect, useState } from "react";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  GOAL_DISPLAYS, GOAL_KINDS, GOAL_MEASURES, GOAL_STATUSES, VIDEO_FORMATS, goalProgress, goalVideos, newStep, parseSteps, videoLength, type Goal, type GoalStep, type GoalVideo,
} from "@/lib/goals";
import { format, parseISO } from "date-fns";
import { getPlatform } from "@/lib/platforms";
import { useAccounts, useContent, useDeleteWithUndo, useGoals, useUpdateGoal, type Account } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AutoInput, Field } from "./bits";
import { GoalKindIcon } from "./goal-card";
import { GoalBar, GoalRing } from "./goal-meter";
import { ProfileAvatar } from "./profile-avatar";

type Patch = Parameters<ReturnType<typeof useUpdateGoal>["mutate"]>[0]["patch"];

const selectClass = "h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60";

export function GoalDrawer() {
  const { openGoalId, openGoal } = useUI();
  const { data: goals } = useGoals();
  const goal = goals?.find((g) => g.id === openGoalId);
  return (
    <Sheet open={!!openGoalId} onOpenChange={(open) => !open && openGoal(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="sr-only">{goal?.title ?? "Goal"}</SheetTitle>
        {goal && <Body key={goal.id} goal={goal} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ goal: g }: { goal: Goal }) {
  const openGoal = useUI((s) => s.openGoal);
  const { data: accounts } = useAccounts();
  const update = useUpdateGoal();
  const del = useDeleteWithUndo();
  const save = (patch: Patch) => update.mutate({ id: g.id, patch });
  const { data: content } = useContent();
  const channel = accounts?.find((a) => a.id === g.account_id);
  const { fraction, label } = goalProgress(g, channel, content);
  const measure = GOAL_MEASURES.find((m) => m.id === g.measure);

  /** Numbers typed into the form; bad input is rejected instead of saved as 0. */
  const saveNumber = (key: "start_value" | "current_value" | "target_value", raw: string) => {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) toast.error("Enter a number");
    else save({ [key]: n });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-2 pr-8">
        <div className="flex gap-1">
          {GOAL_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => save({ kind: k.id })}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                g.kind === k.id ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <GoalKindIcon kind={k.id} className="h-3 w-3" /> {k.label}
            </button>
          ))}
        </div>
        <AutoInput value={g.title} className="-ml-2 text-lg font-semibold" onSave={(title) => save({ title: title.trim() || "Untitled" })} />
        <p className="text-xs text-muted-foreground">Changes save automatically</p>
      </div>

      {fraction !== null && (
        <div className="flex items-center gap-4 rounded-lg border px-4 py-3">
          {g.display === "ring" ? <GoalRing fraction={fraction} size={52} /> : <div className="flex-1"><GoalBar fraction={fraction} display={g.display} /></div>}
          <div className={cn("text-sm", g.display !== "ring" && "shrink-0")}>
            <p className="font-medium tabular-nums">{Math.round(fraction * 100)}%</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Field label="Channel">
          <ChannelSelect value={g.account_id} accounts={accounts ?? []} onChange={(account_id) => save({ account_id })} />
        </Field>
        <Field label="Status">
          <Select value={g.status} onValueChange={(status) => save({ status })}>
            <SelectTrigger aria-label="Status" className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>{GOAL_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Track progress">
          <Select value={g.measure} onValueChange={(m) => save(m === "percent" && g.measure !== "percent" ? { measure: m, current_value: 0 } : m === "videos" && g.measure !== "videos" && g.target_value === 100 ? { measure: m, target_value: 10 } : { measure: m })}>
            <SelectTrigger aria-label="Track progress by" className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>{GOAL_MEASURES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        {g.measure !== "none" && (
          <Field label="Show as">
            <div className="flex gap-1 px-2 py-1">
              {GOAL_DISPLAYS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => save({ display: d.id })}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs transition-colors",
                    g.display === d.id ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {(g.measure === "number" || g.measure === "followers") && (
          <>
            <Field label="Starting at">
              <AutoInput type="number" aria-label="Starting value" value={String(g.start_value)} onSave={(v) => saveNumber("start_value", v)} />
            </Field>
            <Field label="Now">
              {g.measure === "followers" ? (
                <span className="block px-3 py-2 text-sm text-muted-foreground">
                  {channel ? `${channel.followers.toLocaleString("en")} ${getPlatform(channel.platform).audienceLabel} · from Profiles` : "Pick a channel above"}
                </span>
              ) : (
                <AutoInput type="number" aria-label="Current value" value={String(g.current_value)} onSave={(v) => saveNumber("current_value", v)} />
              )}
            </Field>
            <Field label="Target">
              <AutoInput type="number" aria-label="Target value" value={String(g.target_value)} onSave={(v) => saveNumber("target_value", v)} />
            </Field>
            <Field label="Unit">
              <AutoInput
                aria-label="Unit"
                value={g.unit}
                placeholder={g.measure === "followers" && channel ? getPlatform(channel.platform).audienceLabel : "subscribers, $, hours…"}
                onSave={(unit) => save({ unit: unit.trim() })}
              />
            </Field>
          </>
        )}
        {g.measure === "videos" && (
          <>
            <Field label="Count">
              <Select value={g.video_format} onValueChange={(video_format) => save({ video_format })}>
                <SelectTrigger aria-label="Which videos count" className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>{VIDEO_FORMATS.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Target">
              <AutoInput type="number" aria-label="Target videos" value={String(g.target_value)} onSave={(v) => {
                const n = Number(v);
                if (v.trim() === "" || !Number.isInteger(n) || n < 1) toast.error("Enter a whole number of videos");
                else save({ target_value: n });
              }} />
            </Field>
          </>
        )}
        {g.measure === "percent" && (
          <Field label="Progress">
            <PercentSlider value={g.current_value} onCommit={(current_value) => save({ current_value })} />
          </Field>
        )}

        <Field label="Start date">
          <AutoInput type="date" aria-label="Start date" value={g.start_date ?? ""} onSave={(v) => save({ start_date: v || null })} />
        </Field>
        <Field label="Due date">
          <AutoInput type="date" aria-label="Due date" value={g.due_date ?? ""} onSave={(v) => save({ due_date: v || null })} />
        </Field>
      </div>

      {measure && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{measure.hint}</p>}

      {g.measure === "steps" && <Steps steps={parseSteps(g.steps)} onChange={(steps) => save({ steps })} />}
      {g.measure === "videos" && <CountedVideos videos={goalVideos(g, content ?? [])} onOpen={(id) => { openGoal(null); useUI.getState().openContent(id); }} />}

      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan</h3>
        <AutoInput multiline value={g.notes} placeholder="Why it matters, how you'll get there, links…" onSave={(notes) => save({ notes })} />
      </section>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => save({ status: g.status === "done" ? "active" : "done" })}>
          {g.status === "done" ? <><RotateCcw className="h-4 w-4" /> Reopen</> : <><Check className="h-4 w-4" /> Mark done</>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => {
            openGoal(null);
            del("goals", g, g.title);
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

function ChannelSelect({ value, accounts, onChange }: { value: string | null; accounts: Account[]; onChange: (id: string | null) => void }) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger aria-label="Channel" className={selectClass}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No channel</SelectItem>
        {accounts.filter((a) => !a.archived_at || a.id === value).map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <span className="flex items-center gap-2"><ProfileAvatar account={a} className="h-5 w-5" />{a.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Moves freely while dragging and saves once on release. */
function PercentSlider({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [shown, setShown] = useState(value);
  useEffect(() => setShown(value), [value]);
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <Slider
        aria-label="Progress percentage"
        value={[shown]}
        min={0}
        max={100}
        step={1}
        onValueChange={([v]) => v !== undefined && setShown(v)}
        onValueCommit={([v]) => v !== undefined && onCommit(v)}
      />
      <span className="w-10 shrink-0 text-right text-sm tabular-nums">{Math.round(shown)}%</span>
    </div>
  );
}

function Steps({ steps, onChange }: { steps: GoalStep[]; onChange: (steps: GoalStep[]) => void }) {
  const [draft, setDraft] = useState("");
  const set = (id: string, patch: Partial<GoalStep>) => onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Steps · {steps.filter((s) => s.done).length}/{steps.length}
      </h3>
      <div className="space-y-0.5">
        {steps.map((s) => (
          <div key={s.id} className="group flex items-center gap-1.5 rounded-md pl-2 hover:bg-muted/60">
            <Checkbox aria-label={`Done: ${s.label}`} checked={s.done} onCheckedChange={(v) => set(s.id, { done: !!v })} />
            <AutoInput
              aria-label="Step"
              value={s.label}
              className={cn("px-1.5 py-1.5 hover:bg-transparent focus:bg-transparent", s.done && "text-muted-foreground line-through")}
              onSave={(label) => (label.trim() ? set(s.id, { label: label.trim() }) : onChange(steps.filter((x) => x.id !== s.id)))}
            />
            <button
              type="button"
              aria-label={`Remove ${s.label}`}
              onClick={() => onChange(steps.filter((x) => x.id !== s.id))}
              className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange([...steps, newStep(draft.trim())]);
              setDraft("");
            }
          }}
          placeholder="+ Add a step and press Enter"
          className="w-full rounded-md bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground hover:bg-muted/60 focus:bg-muted/60"
        />
      </div>
    </section>
  );
}

/** The videos that count toward a video goal, newest first. */
function CountedVideos({ videos, onOpen }: { videos: GoalVideo[]; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const long = videos.filter((v) => videoLength(v.format) === "long").length;
  const shown = all ? videos : videos.slice(0, 8);
  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Published · {videos.length}</span>
        {videos.length > 0 && <span className="normal-case tracking-normal">{long} long · {videos.length - long} short</span>}
      </h3>
      {videos.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">No published videos yet in this goal's dates. Mark a video Published and it counts here.</p>
      ) : (
        <ul className="space-y-0.5">
          {shown.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => onOpen(v.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60">
                <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", videoLength(v.format) === "long" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                  {videoLength(v.format) === "long" ? "Long" : "Short"}
                </span>
                <span className="min-w-0 flex-1 truncate">{v.title}</span>
                {v.publish_at && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{format(parseISO(v.publish_at), "MMM d")}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {videos.length > 8 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-1 w-full rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60">
          {all ? "Show less" : `Show all ${videos.length}`}
        </button>
      )}
    </section>
  );
}
