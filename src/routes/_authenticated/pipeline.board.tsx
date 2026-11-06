import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Columns3, Rows3 } from "lucide-react";
import { useAccounts, useChecklist, useContent, useStages, useUpdateContent, type ContentItem } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { FORMATS, PLATFORMS, labelOf } from "@/lib/constants";
import { stageIndex } from "@/lib/runs";
import { Board, type Progress } from "@/components/pipeline-board";
import { RefLink } from "@/components/ref-link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoInput, EmptyState, PlatformBadge } from "@/components/bits";
import { useNewContent } from "@/components/app-shell";
import { SponsoredTag } from "@/components/sponsored-tag";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pipeline/board")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Pipeline · My content B/S CRM" },
      { name: "description", content: "Move every video from idea to published." },
      { property: "og:title", content: "Pipeline · My content B/S CRM" },
      { property: "og:description", content: "Move every video from idea to published." },
    ],
  }),
  component: PipelinePage,
});


function PipelinePage() {
  const { pipelineView, setPipelineView, accountId } = useUI();
  const { data: content, isLoading } = useContent();
  const { data: checklist } = useChecklist();
  const { stages } = useStages();
  const [platform, setPlatform] = useState("all");
  const [fmt, setFmt] = useState("all");
  const [tag, setTag] = useState("all");

  const allTags = useMemo(() => [...new Set(content?.flatMap((c) => c.tags) ?? [])].sort(), [content]);
  const items = useMemo(
    () =>
      (content ?? []).filter(
        (c) =>
          (!accountId || c.account_id === accountId) &&
          (platform === "all" || c.platforms.includes(platform)) &&
          (fmt === "all" || c.format === fmt) &&
          (tag === "all" || c.tags.includes(tag)),
      ),
    [content, accountId, platform, fmt, tag],
  );
  const progress = useMemo(() => {
    const p: Progress = {};
    checklist?.forEach((c) => {
      const e = (p[c.content_item_id] ??= { done: 0, total: 0 });
      e.total++;
      if (c.done) e.done++;
    });
    return p;
  }, [checklist]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap">
        <div className="col-span-2 mr-auto flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground" title="Back to focus">
            <Link to="/pipeline" aria-label="Back to focus"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-xl font-semibold">Pipeline</h1>
          <span className="hidden text-[10px] text-muted-foreground/80 lg:inline">Right-click a column to rename, add or remove</span>
        </div>
        <FilterSelect value={platform} onChange={setPlatform} all="All platforms" options={PLATFORMS} />
        <FilterSelect value={fmt} onChange={setFmt} all="All formats" options={FORMATS} />
        <FilterSelect value={tag} onChange={setTag} all="All tags" options={allTags.map((t) => ({ id: t, label: `#${t}` }))} />
        <div className="flex rounded-full border border-border bg-card p-1">
          {(["board", "table"] as const).map((v) => (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={pipelineView === v}
              key={v}
              onClick={() => setPipelineView(v)}
              className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm", pipelineView === v ? "bg-muted font-medium" : "text-muted-foreground")}
            >
              {v === "board" ? <Columns3 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
              {v === "board" ? "Board" : "Table"}
            </Button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {stages.map((s) => (
            <div key={s.id} className="w-72 shrink-0 space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ))}
        </div>
      ) : pipelineView === "board" ? (
        <Board items={items} progress={progress} />
      ) : (
        <ContentTable items={items} progress={progress} />
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: readonly { id: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-full gap-2 text-sm sm:w-auto", value !== "all" && "border-primary/50 text-primary")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ContentTable({ items, progress }: { items: ContentItem[]; progress: Progress }) {
  const update = useUpdateContent();
  const { data: accounts } = useAccounts();
  const openContent = useUI((s) => s.openContent);
  const newContent = useNewContent();
  const { stages } = useStages();
  if (!items.length)
    return <EmptyState title="No content matches" hint="Try clearing filters or add something new." action={<Button size="sm" onClick={() => newContent()}>New content item</Button>} />;
  const sorted = [...items].sort((a, b) => stageIndex(a.stage, stages) - stageIndex(b.stage, stages));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Title</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Platforms</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Checklist</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="py-1">
                <div className="flex items-center gap-1">
                  <AutoInput value={i.title} onSave={(title) => update.mutate({ id: i.id, patch: { title } })} />
                  <SponsoredTag videoId={i.id} />
                  <RefLink url={i.ref_url} />
                  <button onClick={() => openContent(i.id)} className="shrink-0 rounded px-1.5 text-xs text-muted-foreground hover:bg-muted">Open</button>
                </div>
              </TableCell>
              <TableCell className="py-1">
                <Select value={i.stage} onValueChange={(stage) => update.mutate({ id: i.id, patch: { stage } })}>
                  <SelectTrigger className="h-7 w-32 border-0 bg-transparent shadow-none hover:bg-muted"><SelectValue /></SelectTrigger>
                  <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell><div className="flex gap-1">{i.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}</div></TableCell>
              <TableCell className="text-sm text-muted-foreground">{labelOf(FORMATS, i.format)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{accounts?.find((a) => a.id === i.account_id)?.name ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{i.due_date ? format(parseISO(i.due_date), "MMM d") : "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{(() => { const p = progress[i.id]; return p ? `${p.done}/${p.total}` : "—"; })()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
