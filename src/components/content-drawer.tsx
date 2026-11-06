import { useState } from "react";
import { Copy, ExternalLink, Handshake, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  useAccounts, useChecklist, useContent, useDeals, useDeleteWithUndo, useRepurpose, useStages,
  useUpdateContent, useUpdateDeal, type ContentItem,
} from "@/lib/queries";
import { dealLinkChanges, linkableDeals } from "@/lib/deals";
import { useUI } from "@/lib/store";
import { FORMATS, PLATFORMS, PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { localDateTime } from "@/lib/calendar";
import { formatMinutes, parseDuration } from "@/lib/time";
import { AutoInput, Field, PlatformDot } from "./bits";
import { ProfileAvatar } from './profile-avatar';
import { SponsoredTag } from "./sponsored-tag";
import { LinkField, RefLink } from "./ref-link";
import { ResourcesSection, TaskChecklist, ThumbnailSection } from "./content-drawer-sections";

export function ContentDrawer() {
  const { openContentId, openContent } = useUI();
  const { data: content } = useContent();
  const item = content?.find((c) => c.id === openContentId);
  return (
    <Sheet open={!!openContentId} onOpenChange={(o) => !o && openContent(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {item ? <Body key={item.id} id={item.id} /> : <SheetTitle className="sr-only">Content</SheetTitle>}
      </SheetContent>
    </Sheet>
  );
}

function Body({ id }: { id: string }) {
  const { openContent } = useUI();
  const { data: content } = useContent();
  const { data: accounts } = useAccounts();
  const { data: checklist } = useChecklist();
  const update = useUpdateContent();
  const { stages } = useStages();
  const repurpose = useRepurpose();
  const del = useDeleteWithUndo();
  const item = content?.find((c) => c.id === id);
  if (!item) return <SheetTitle>Content no longer available</SheetTitle>;
  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => update.mutate({ id, patch });
  const checks = checklist?.filter((c) => c.content_item_id === id) ?? [];
  const parent = content?.find((c) => c.id === item.parent_id);
  const children = content?.filter((c) => c.parent_id === id) ?? [];

  return (
    <div className="space-y-6 pb-10">
      <div className="pr-8">
        <SheetTitle className="sr-only">{item.title}</SheetTitle>
        <AutoInput value={item.title} onSave={(title) => save({ title: title || "Untitled" })} className="-ml-2 text-xl font-semibold" />
        <p className="flex items-center gap-2 px-0 text-xs text-muted-foreground">
          Changes save automatically
          <SponsoredTag videoId={item.id} />
          <RefLink url={item.ref_url} />
        </p>
      </div>

      <div className="space-y-1">
        <Field label="Stage">
          <Select value={item.stage} onValueChange={(stage) => save({ stage })}>
            <SelectTrigger className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60"><SelectValue /></SelectTrigger>
            <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Account">
          <Select value={item.account_id ?? "none"} onValueChange={(v) => save({ account_id: v === "none" ? null : v })}>
            <SelectTrigger className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No account</SelectItem>
              {accounts?.map((a) => (
                <SelectItem key={a.id} value={a.id}><span className="flex items-center gap-2"><ProfileAvatar account={a} className="h-5 w-5" />{a.name}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Format">
          <Select value={item.format} onValueChange={(format) => save({ format })}>
            <SelectTrigger className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60"><SelectValue /></SelectTrigger>
            <SelectContent>{FORMATS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={item.priority} onValueChange={(priority) => save({ priority })}>
            <SelectTrigger className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Platforms">
          <div className="flex flex-wrap gap-1 px-2 py-1">
            {PLATFORMS.map((p) => {
              const on = item.platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => save({ platforms: on ? item.platforms.filter((x) => x !== p.id) : [...item.platforms, p.id] })}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors",
                    on ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <PlatformDot platform={p.id} className="h-1.5 w-1.5" /> {p.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Due date">
          <AutoInput type="date" value={item.due_date ?? ""} onSave={(v) => save({ due_date: v || null })} />
        </Field>
        <Field label="Publish at">
          <AutoInput
            type="datetime-local"
            value={localDateTime(item.publish_at)}
            onSave={(v) => save({ publish_at: v ? new Date(v).toISOString() : null })}
          />
        </Field>
        <Field label="Time logged">
          <TimeLogged minutes={item.minutes_logged ?? 0} onChange={(minutes_logged) => save({ minutes_logged })} />
        </Field>
        <Field label="Tags">
          <AutoInput
            value={item.tags.join(", ")}
            placeholder="comma, separated"
            onSave={(v) => save({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })}
          />
        </Field>
        <Field label="Script link">
          <div className="flex items-center">
            <AutoInput value={item.script_url ?? ""} placeholder="Paste a Google Doc or Notion link" onSave={(v) => save({ script_url: v || null })} />
            {item.script_url && (
              <a href={item.script_url} target="_blank" rel="noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </Field>
        <Field label="Reference">
          <LinkField label="Reference" value={item.ref_url} placeholder="Link to a post that inspired this" onSave={(ref_url) => save({ ref_url })} />
        </Field>
        <Field label="Brand deal">
          <DealLink video={item} />
        </Field>
      </div>

      <TaskChecklist videoId={id} checks={checks} />

      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Title options</h3>
        <AutoInput
          multiline
          value={item.title_options.join("\n")}
          placeholder="One title per line"
          onSave={(v) => save({ title_options: v.split("\n").map((t) => t.trim()).filter(Boolean) })}
        />
      </section>
      <ThumbnailSection item={item} />
      <ResourcesSection item={item} />
      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</h3>
        <AutoInput multiline value={item.notes} placeholder="Anything worth remembering" onSave={(v) => save({ notes: v })} />
      </section>

      {(parent || children.length > 0) && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked content</h3>
          {parent && (
            <button onClick={() => openContent(parent.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> Repurposed from: {parent.title}
            </button>
          )}
          {children.map((c) => (
            <button key={c.id} onClick={() => openContent(c.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> {c.title}
            </button>
          ))}
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={repurpose.isPending} onClick={() => repurpose.mutate({ item, accounts: accounts ?? [] })}>
          <Copy className="h-4 w-4" /> Repurpose into Short, Reel, TikTok
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => {
            openContent(null);
            del("content_items", item, item.title);
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

const QUICK_ADD = [15, 30, 60] as const;

/** Total time spent on a video: type a duration ("2h 15m", "90") or tap a quick add. */
function TimeLogged({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  // Remounting the input puts the saved value back after an unreadable entry.
  const [resetKey, setResetKey] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <div className="min-w-24 flex-1">
        <AutoInput
          key={resetKey}
          aria-label="Time logged"
          value={minutes ? formatMinutes(minutes) : ""}
          placeholder="e.g. 2h 15m"
          onSave={(v) => {
            const next = parseDuration(v);
            if (next === null) {
              toast.error("Try a time like 2h 15m or 90");
              setResetKey((k) => k + 1);
            }
            else if (next !== minutes) onChange(Math.min(next, 100_000));
          }}
        />
      </div>
      {QUICK_ADD.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(minutes + m)}
          className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          +{m < 60 ? `${m}m` : `${m / 60}h`}
        </button>
      ))}
    </div>
  );
}

/** Pick the brand deal this video is for. The link is stored on the deal (brand_deals.content_item_id). */
function DealLink({ video }: { video: ContentItem }) {
  const { openContent, openDeal } = useUI();
  const { data: deals } = useDeals();
  const update = useUpdateDeal();
  const options = linkableDeals(deals ?? [], video);
  const linked = options.find((d) => d.content_item_id === video.id);

  const choose = (value: string) => {
    for (const { id, content_item_id } of dealLinkChanges(deals ?? [], video.id, value === "none" ? null : value)) {
      update.mutate({ id, patch: { content_item_id } });
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Select value={linked?.id ?? "none"} onValueChange={choose} disabled={!deals}>
        <SelectTrigger aria-label="Brand deal" className="h-9 min-w-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not linked</SelectItem>
          {options.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.brand || "Untitled brand"}
              {d.title ? <span className="text-muted-foreground"> · {d.title}</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {linked && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          title="Open brand deal"
          aria-label="Open brand deal"
          onClick={() => { openContent(null); openDeal(linked.id); }}
        >
          <Handshake className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
