import { useRef, useState } from "react";
import { ImagePlus, Link2, Library, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { Json } from "@/integrations/supabase/types";
import {
  openPrivateFile, useAddChecklistItem, useLibraryItems, useRemoveChecklistItem, useRenameChecklistItem, useSetThumbnail,
  useToggleChecklist, useUpdateContent, type ChecklistItem, type ContentItem,
} from "@/lib/queries";
import { addLibraryResource, addLinkResource, parseResources, removeResource, sortLibrary, type Resource } from "@/lib/library";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AutoInput } from "./bits";
import { InlineEdit } from "./inline-edit";
import { afterClose, menuClass, menuDangerClass, menuItemClass } from "@/lib/menu";
import { LibraryImage, LibraryItemIcon, LinkFavicon } from "./library-bits";
import { LinkField } from "./ref-link";

const heading = "mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
const tiny = "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground";

/* ---------- Task checklist ---------- */

export function TaskChecklist({ videoId, checks }: { videoId: string; checks: ChecklistItem[] }) {
  const toggle = useToggleChecklist();
  const add = useAddChecklistItem();
  const rename = useRenameChecklistItem();
  const remove = useRemoveChecklistItem();
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const done = checks.filter((c) => c.done).length;

  return (
    <section>
      <h3 className={heading}>Task checklist · {done}/{checks.length}</h3>
      <ul className="space-y-px">
        {checks.map((c) => (
          <ContextMenu key={c.id}>
            <ContextMenuTrigger asChild>
              <li className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
                <Checkbox
                  aria-label={c.label}
                  checked={c.done}
                  onCheckedChange={(v) => toggle.mutate({ id: c.id, done: !!v })}
                  className="h-3.5 w-3.5"
                />
                {renaming === c.id ? (
                  <InlineEdit
                    label="Task name"
                    value={c.label}
                    className="flex-1 text-xs"
                    onSave={(label) => label.trim() && rename.mutate({ id: c.id, label: label.trim().slice(0, 120) })}
                    onDone={() => setRenaming(null)}
                  />
                ) : (
                  <span
                    onClick={() => toggle.mutate({ id: c.id, done: !c.done })}
                    className={cn("min-w-0 flex-1 cursor-pointer break-words text-xs", c.done && "text-muted-foreground line-through")}
                  >
                    {c.label}
                  </span>
                )}
              </li>
            </ContextMenuTrigger>
            <ContextMenuContent className={menuClass} onCloseAutoFocus={(e) => e.preventDefault()}>
              <ContextMenuItem className={menuItemClass} onSelect={afterClose(() => setRenaming(c.id))}><Pencil /> Rename</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className={menuDangerClass} onSelect={() => remove.mutate(c.id)}><Trash2 /> Remove</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </ul>
      <input
        aria-label="New task"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            add.mutate({ content_item_id: videoId, label: draft.trim().slice(0, 120), position: checks.length });
            setDraft("");
          }
        }}
        placeholder="+ Add a task and press Enter"
        className="mt-0.5 w-full rounded-md bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground hover:bg-muted/60 focus:bg-muted/60"
      />
      {checks.length > 0 && <p className="mt-1 hidden px-2 text-[10px] text-muted-foreground/80 sm:block">Right-click a task to rename or remove it</p>}
    </section>
  );
}

/* ---------- Thumbnail: concepts, an uploaded image and a reference link ---------- */

export function ThumbnailSection({ item }: { item: ContentItem }) {
  const update = useUpdateContent();
  const setThumbnail = useSetThumbnail();
  const input = useRef<HTMLInputElement>(null);
  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => update.mutate({ id: item.id, patch });

  return (
    <section>
      <h3 className={heading}>Thumbnail concepts</h3>
      <div className="mb-1.5 flex flex-wrap items-start gap-2">
        {item.thumbnail_path ? (
          <div className="group relative w-36 overflow-hidden rounded-md border">
            <button type="button" className="block w-full" title="Open full size" onClick={() => void openPrivateFile(item.thumbnail_path!)}>
              <LibraryImage path={item.thumbnail_path} alt={`${item.title} thumbnail`} className="aspect-video w-full" />
            </button>
            <button
              type="button"
              aria-label="Remove thumbnail"
              disabled={setThumbnail.isPending}
              onClick={() => setThumbnail.mutate({ item, file: null })}
              className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground group-hover:flex"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <button type="button" className={tiny} disabled={setThumbnail.isPending} onClick={() => input.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" /> {setThumbnail.isPending ? "Uploading…" : item.thumbnail_path ? "Replace" : "Upload thumbnail"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload thumbnail"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setThumbnail.mutate({ item, file });
            e.target.value = "";
          }}
        />
      </div>
      <div className="mb-1 text-xs">
        <LinkField label="Thumbnail reference" value={item.thumbnail_url} placeholder="Reference thumbnail link (optional)" onSave={(thumbnail_url) => save({ thumbnail_url })} />
      </div>
      <AutoInput multiline value={item.thumbnail_concepts} placeholder="Describe thumbnail ideas" onSave={(v) => save({ thumbnail_concepts: v })} />
    </section>
  );
}

/* ---------- Resources: library items or links (edit view only) ---------- */

export function ResourcesSection({ item }: { item: ContentItem }) {
  const update = useUpdateContent();
  const { data: library } = useLibraryItems();
  const { openContent, openLibraryItem } = useUI();
  const [addingLink, setAddingLink] = useState(false);
  const [link, setLink] = useState("");
  const resources = parseResources(item.resources);
  const save = (next: Resource[]) => update.mutate({ id: item.id, patch: { resources: next as unknown as Json } });
  const linked = new Set(resources.flatMap((r) => (r.kind === "library" ? [r.library_item_id] : [])));
  // A video with a profile can only pick from that profile's library; a video with none sees everything.
  const choices = sortLibrary((library ?? []).filter((l) => !linked.has(l.id) && (!item.account_id || l.account_id === item.account_id)));

  const addLink = () => {
    const next = addLinkResource(resources, link);
    if (!next) return void toast.error("Enter a valid link");
    save(next);
    setLink("");
    setAddingLink(false);
  };

  return (
    <section>
      <h3 className={heading}>Resources</h3>
      {resources.length > 0 && (
        <ul className="mb-1 space-y-px">
          {resources.map((r) => {
            const source = r.kind === "library" ? library?.find((l) => l.id === r.library_item_id) : undefined;
            const missing = r.kind === "library" && library && !source;
            return (
              <li key={r.id} className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/60">
                {r.kind === "link" ? <LinkFavicon url={r.url} /> : source ? <LibraryItemIcon item={source} /> : <Library className="h-3.5 w-3.5 text-muted-foreground" />}
                {r.kind === "link" ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline" title={r.url}>{r.label}</a>
                ) : (
                  <button
                    type="button"
                    disabled={!source}
                    onClick={() => { openContent(null); openLibraryItem(r.library_item_id); }}
                    className={cn("min-w-0 flex-1 truncate text-left hover:underline", missing && "text-muted-foreground line-through")}
                    title={missing ? "Removed from the library" : "Open in Library"}
                  >
                    {source?.title ?? r.label}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${r.label}`}
                  onClick={() => save(removeResource(resources, r.id))}
                  className="text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {addingLink ? (
        <form onSubmit={(e) => { e.preventDefault(); addLink(); }} className="flex items-center gap-1 px-1">
          <input
            autoFocus
            aria-label="Resource link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setAddingLink(false); }}
            onBlur={() => { if (!link.trim()) setAddingLink(false); }}
            placeholder="Paste a link and press Enter"
            className="h-6 min-w-0 flex-1 rounded-md bg-muted/60 px-2 text-xs outline-none"
          />
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className={tiny} onClick={() => setAddingLink(true)}><Link2 className="h-3.5 w-3.5" /> Link</button>
          <Select
            value=""
            onValueChange={(id) => {
              const source = library?.find((l) => l.id === id);
              if (source) save(addLibraryResource(resources, source));
            }}
          >
            <SelectTrigger aria-label="Add from library" className={cn(tiny, "h-6 w-auto border-0 bg-transparent shadow-none [&>svg:last-child]:hidden")}>
              <Library className="h-3.5 w-3.5" /> From library
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {choices.length ? (
                choices.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-xs">
                    <span className="flex items-center gap-1.5"><LibraryItemIcon item={l} />{l.title}</span>
                  </SelectItem>
                ))
              ) : (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{library?.length ? "Everything is already added" : "Your library is empty"}</p>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </section>
  );
}
