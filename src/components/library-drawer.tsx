import { ExternalLink, Pin, PinOff, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { openPrivateFile, useLibraryItems, useLibraryProjects, useRemoveLibraryItem, useUpdateLibraryItem } from "@/lib/queries";
import { formatBytes, LIBRARY_KINDS, toHttpUrl } from "@/lib/library";
import { useUI } from "@/lib/store";
import { toast } from "sonner";
import { AutoInput, Field } from "./bits";
import { LibraryImage, LibraryItemIcon } from "./library-bits";

/** Open and edit one library item. Mounted once in AppShell, opened with openLibraryItem(id). */
export function LibraryDrawer() {
  const { openLibraryItemId, openLibraryItem } = useUI();
  const { data: items } = useLibraryItems();
  const { data: projects } = useLibraryProjects();
  const update = useUpdateLibraryItem();
  const remove = useRemoveLibraryItem();
  const item = items?.find((i) => i.id === openLibraryItemId);
  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => item && update.mutate({ id: item.id, patch });

  return (
    <Sheet open={!!openLibraryItemId} onOpenChange={(o) => !o && openLibraryItem(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetTitle className="sr-only">{item?.title ?? "Library item"}</SheetTitle>
        {item && (
          <div key={item.id} className="space-y-5 pb-10">
            <div className="pr-8">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <LibraryItemIcon item={item} />
                {LIBRARY_KINDS.find((k) => k.id === item.kind)?.label}
                {item.file_size ? ` · ${formatBytes(item.file_size)}` : ""}
              </p>
              <AutoInput value={item.title} aria-label="Title" className="-ml-2 text-lg font-semibold" onSave={(title) => save({ title: title.trim().slice(0, 200) || "Untitled" })} />
            </div>

            {item.kind === "image" && (
              <button type="button" onClick={() => item.file_path && void openPrivateFile(item.file_path)} className="block w-full overflow-hidden rounded-lg border" title="Open full size">
                <LibraryImage path={item.file_path} alt={item.title} className="max-h-80 w-full object-contain" />
              </button>
            )}
            {item.kind === "doc" && item.file_path && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void openPrivateFile(item.file_path!)}>
                <ExternalLink className="h-3.5 w-3.5" /> Open {item.file_name}
              </Button>
            )}
            {item.kind === "link" && (
              <Field label="Link">
                <div className="flex items-center">
                  <AutoInput
                    value={item.url}
                    aria-label="Link"
                    placeholder="https://"
                    onSave={(v) => {
                      const url = toHttpUrl(v);
                      if (url) save({ url });
                      else toast.error("Enter a valid link");
                    }}
                  />
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Open link">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </Field>
            )}

            <div className="space-y-1">
              <Field label="Project">
                <Select value={item.project_id ?? "none"} onValueChange={(v) => save({ project_id: v === "none" ? null : v })}>
                  <SelectTrigger aria-label="Project" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No project</SelectItem>
                    {/* An item can only sit in a project of its own profile. */}
                    {projects?.filter((p) => p.account_id === item.account_id).map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <section>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{item.kind === "note" ? "Note" : "Notes"}</h3>
              <AutoInput multiline value={item.body} aria-label="Notes" placeholder={item.kind === "note" ? "Write anything…" : "Why it's useful, where to use it…"} onSave={(body) => save({ body })} />
            </section>

            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => save({ pinned: !item.pinned })}>
                {item.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {item.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 gap-1.5 text-xs text-destructive"
                onClick={() => { openLibraryItem(null); remove(item); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
