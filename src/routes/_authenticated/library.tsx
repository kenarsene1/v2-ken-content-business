import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ChevronRight, Folder, FolderInput, FolderPlus, Library as LibraryIcon, Link2, Pencil, Pin, PinOff, Search, StickyNote, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent,
  ContextMenuSubTrigger, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { InlineEdit } from "@/components/inline-edit";
import { QuickAdd } from "@/components/quick-add";
import { afterClose, menuClass, menuDangerClass, menuItemClass } from "@/lib/menu";
import { LibraryImage, LibraryItemIcon } from "@/components/library-bits";
import {
  isMissingTableError, useActiveAccounts, useCreateLibraryItem, useCreateLibraryProject, useMoveLibraryProject, useRemoveLibraryItem,
  useRemoveLibraryProject, useScopedLibraryItems, useScopedLibraryProjects, useUpdateLibraryItem, useUpdateLibraryProject,
  type LibraryItem, type LibraryProject,
} from "@/lib/queries";
import { formatBytes, hostOf, kindForFile, LIBRARY_KINDS, sortLibrary, titleFromFile, toHttpUrl, UPLOAD_ACCEPT, type LibraryKind } from "@/lib/library";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library · My content B/S CRM" },
      { name: "description", content: "Notes, docs, images and links for your videos, organized by project." },
      { property: "og:title", content: "Library · My content B/S CRM" },
      { property: "og:description", content: "Notes, docs, images and links for your videos, organized by project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

const small = "h-7 gap-1.5 px-2.5 text-xs";
type Adding = null | "link" | "project";

function LibraryPage() {
  const { data: items, isLoading, error, refetch } = useScopedLibraryItems();
  const { data: projects } = useScopedLibraryProjects();
  const create = useCreateLibraryItem();
  const createProject = useCreateLibraryProject();
  const openItem = useUI((s) => s.openLibraryItem);
  const accountId = useUI((s) => s.accountId);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | LibraryKind>("all");
  const [adding, setAdding] = useState<Adding>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const project = projects?.find((p) => p.id === projectId) ?? null;
  // The open project was removed (here or elsewhere): go back to the top level.
  useEffect(() => {
    if (projectId && projects && !project) setProjectId(null);
  }, [projectId, projects, project]);

  const query = search.trim().toLowerCase();
  const visible = sortLibrary(
    (items ?? []).filter(
      (i) =>
        (query ? `${i.title} ${i.body} ${i.url ?? ""} ${i.file_name ?? ""}`.toLowerCase().includes(query) : i.project_id === projectId) &&
        (kind === "all" || i.kind === kind),
    ),
  );
  const folders = !query && !projectId ? sortLibrary(projects ?? []) : [];
  const countIn = (id: string) => (items ?? []).filter((i) => i.project_id === id).length;

  // New things belong to the profile picked in the sidebar; inside a project they follow that project.
  const owner = project ? project.account_id : accountId;
  const addNote = () => {
    const id = crypto.randomUUID();
    create.mutate({ id, kind: "note", title: "Untitled note", project_id: projectId, account_id: owner });
    openItem(id);
  };
  const addLink = (raw: string) => {
    const url = toHttpUrl(raw);
    if (!url) return void toast.error("Enter a valid link");
    create.mutate({ id: crypto.randomUUID(), kind: "link", title: hostOf(url), url, project_id: projectId, account_id: owner });
  };
  const upload = async (files: FileList | File[] | null) => {
    const list = [...(files ?? [])];
    let done = 0;
    for (const file of list) {
      try {
        await create.mutateAsync({ kind: kindForFile(file), title: titleFromFile(file.name), project_id: projectId, account_id: owner, file });
        done++;
      } catch { /* The mutation already showed why. */ }
    }
    if (done > 1) toast.success(`${done} files added`);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  return (
    <div
      className="mx-auto max-w-6xl space-y-3 calendar-enter"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav aria-label="Library location" className="flex min-w-0 items-center gap-1">
          <button type="button" onClick={() => setProjectId(null)} className={cn("text-base font-semibold", project && "text-muted-foreground hover:text-foreground")}>
            <h1 className="inline">Library</h1>
          </button>
          {project && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate text-base font-semibold">{project.name}</span>
            </>
          )}
        </nav>
        <div className="flex items-center gap-0.5" role="group" aria-label="Filter by type">
          {(["all", ...LIBRARY_KINDS.map((k) => k.id)] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
              className={cn("h-6 rounded-full px-2 text-xs transition-colors", kind === id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {id === "all" ? "All" : LIBRARY_KINDS.find((k) => k.id === id)?.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-40 sm:flex-none">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search library" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
          </div>
          <Button variant="outline" size="sm" className={small} onClick={addNote}><StickyNote className="h-3.5 w-3.5" />Note</Button>
          <Button variant="outline" size="sm" className={small} onClick={() => setAdding(adding === "link" ? null : "link")}><Link2 className="h-3.5 w-3.5" />Link</Button>
          <Button variant="outline" size="sm" className={small} onClick={() => fileInput.current?.click()}><Upload className="h-3.5 w-3.5" />Upload</Button>
          {!projectId && <Button variant="outline" size="sm" className={small} onClick={() => setAdding(adding === "project" ? null : "project")}><FolderPlus className="h-3.5 w-3.5" />Project</Button>}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            className="hidden"
            aria-label="Upload files"
            onChange={(e) => { void upload(e.target.files); e.target.value = ""; }}
          />
        </div>
      </div>

      {adding && (
        <QuickAdd
          key={adding}
          placeholder={adding === "link" ? "Paste a link and press Enter" : "Project name"}
          onSubmit={(v) => {
            if (adding === "link") addLink(v);
            else if (v.trim()) createProject.mutate({ id: crypto.randomUUID(), name: v.trim().slice(0, 80), account_id: accountId });
            setAdding(null);
          }}
          onCancel={() => setAdding(null)}
        />
      )}

      <div
        className={cn(
          "canvas-dots min-h-[60vh] rounded-xl border p-3 transition-colors",
          dragging && "border-primary/60 bg-primary/5",
        )}
      >
        {isMissingTableError(error, "library_") ? (
          <Empty title="The Library needs a quick database update" hint="In Lovable, ask it to apply the latest database migration, then reload." />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">The library couldn't load.</p>
            <Button variant="ghost" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : !folders.length && !visible.length ? (
          <Empty
            title={query ? "Nothing matches" : project ? "This project is empty" : "Your library is empty"}
            hint={query ? "Try another search." : "Add a note or link, or drop files here."}
          />
        ) : (
          <div className="space-y-4">
            {folders.length > 0 && (
              <section aria-label="Projects" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {folders.map((p) => <ProjectTile key={p.id} project={p} count={countIn(p.id)} onOpen={() => setProjectId(p.id)} />)}
              </section>
            )}
            {visible.length > 0 && (
              <section aria-label="Items" className="grid grid-cols-2 items-start gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {visible.map((item) => <ItemCard key={item.id} item={item} projects={projects ?? []} />)}
              </section>
            )}
          </div>
        )}
      </div>
      <p className="text-center text-[10px] text-muted-foreground/80">
        <span className="hidden sm:inline">Right-click</span><span className="sm:hidden">Long-press</span> to pin, rename, move or remove · drop files anywhere to upload
      </p>
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <LibraryIcon className="mb-2 h-5 w-5 text-primary/60" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ProjectTile({ project, count, onOpen }: { project: LibraryProject; count: number; onOpen: () => void }) {
  const update = useUpdateLibraryProject();
  const remove = useRemoveLibraryProject();
  const move = useMoveLibraryProject();
  const [renaming, setRenaming] = useState(false);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group relative flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/30 motion-reduce:transform-none">
          <Folder className="h-4 w-4 shrink-0 fill-primary/15 text-primary" />
          {renaming ? (
            <InlineEdit label="Project name" value={project.name} className="min-w-0 flex-1 text-xs" onSave={(name) => name.trim() && update.mutate({ id: project.id, patch: { name: name.trim().slice(0, 80) } })} onDone={() => setRenaming(false)} />
          ) : (
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-xs font-medium after:absolute after:inset-0">
              {project.name}
            </button>
          )}
          {project.pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-primary" aria-label="Pinned" />}
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{count}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menuClass} onCloseAutoFocus={(e) => e.preventDefault()}>
        <ContextMenuItem className={menuItemClass} onSelect={onOpen}><Folder /> Open</ContextMenuItem>
        <ContextMenuItem className={menuItemClass} onSelect={() => update.mutate({ id: project.id, patch: { pinned: !project.pinned } })}>
          {project.pinned ? <PinOff /> : <Pin />} {project.pinned ? "Unpin" : "Pin"}
        </ContextMenuItem>
        <ContextMenuItem className={menuItemClass} onSelect={afterClose(() => setRenaming(true))}><Pencil /> Rename</ContextMenuItem>
        <ProfileMenu current={project.account_id} label="Move all to profile" onPick={(account_id) => move.mutate({ id: project.id, account_id })} />
        <ContextMenuSeparator />
        <ContextMenuItem className={menuDangerClass} onSelect={() => remove(project)}><Trash2 /> Remove project</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ItemCard({ item, projects }: { item: LibraryItem; projects: LibraryProject[] }) {
  const openItem = useUI((s) => s.openLibraryItem);
  const update = useUpdateLibraryItem();
  const remove = useRemoveLibraryItem();
  const [renaming, setRenaming] = useState(false);
  const meta =
    item.kind === "link" ? hostOf(item.url) : item.kind === "note" ? "" : [formatBytes(item.file_size), item.file_name?.split(".").pop()?.toUpperCase()].filter(Boolean).join(" · ");

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm motion-reduce:transform-none">
          {item.kind === "image" && <LibraryImage path={item.file_path} alt={item.title} className="aspect-video w-full border-b" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <LibraryItemIcon item={item} />
              {renaming ? (
                <InlineEdit label="Title" value={item.title} className="min-w-0 flex-1 text-xs" onSave={(title) => title.trim() && update.mutate({ id: item.id, patch: { title: title.trim().slice(0, 200) } })} onDone={() => setRenaming(false)} />
              ) : (
                <button
                  type="button"
                  onClick={() => openItem(item.id)}
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {item.title}
                </button>
              )}
              {item.pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-primary" aria-label="Pinned" />}
            </div>
            {item.kind === "note" && item.body && <p className="line-clamp-3 whitespace-pre-line break-words text-[11px] leading-relaxed text-muted-foreground">{item.body}</p>}
            {meta && <p className="truncate text-[10px] text-muted-foreground">{meta}</p>}
          </div>
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent className={menuClass} onCloseAutoFocus={(e) => e.preventDefault()}>
        <ContextMenuItem className={menuItemClass} onSelect={() => openItem(item.id)}><Pencil /> Open & edit</ContextMenuItem>
        <ContextMenuItem className={menuItemClass} onSelect={() => update.mutate({ id: item.id, patch: { pinned: !item.pinned } })}>
          {item.pinned ? <PinOff /> : <Pin />} {item.pinned ? "Unpin" : "Pin"}
        </ContextMenuItem>
        <ContextMenuItem className={menuItemClass} onSelect={afterClose(() => setRenaming(true))}><Pencil /> Rename</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className={menuItemClass}><FolderInput /> Move to</ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-64 w-44 overflow-y-auto">
            <ContextMenuItem className={menuItemClass} disabled={!item.project_id} onSelect={() => update.mutate({ id: item.id, patch: { project_id: null } })}>No project</ContextMenuItem>
            {projects.map((p) => (
              <ContextMenuItem key={p.id} className={menuItemClass} disabled={p.id === item.project_id} onSelect={() => update.mutate({ id: item.id, patch: { project_id: p.id, account_id: p.account_id } })}>
                <Folder /> <span className="truncate">{p.name}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ProfileMenu current={item.account_id} label="Move to profile" onPick={(account_id) => update.mutate({ id: item.id, patch: { account_id, project_id: null } })} />
        <ContextMenuSeparator />
        <ContextMenuItem className={menuDangerClass} onSelect={() => remove(item)}><Trash2 /> Remove</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** "Move to profile" submenu, shared by items and projects. Pass null to leave a profile (shows only under All accounts). */
function ProfileMenu({ current, label, onPick }: { current: string | null; label: string; onPick: (accountId: string | null) => void }) {
  const { data: accounts } = useActiveAccounts();
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={menuItemClass}><UserRound /> {label}</ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-64 w-44 overflow-y-auto">
        {(accounts ?? []).map((a) => (
          <ContextMenuItem key={a.id} className={menuItemClass} disabled={a.id === current} onSelect={() => onPick(a.id)}>
            <span className="truncate">{a.name}</span>
          </ContextMenuItem>
        ))}
        <ContextMenuItem className={menuItemClass} disabled={current === null} onSelect={() => onPick(null)}>No profile</ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
