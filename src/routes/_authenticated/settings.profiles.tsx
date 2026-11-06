import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAccounts, useContent, useIdeas, useUpdateAccount, type Account } from "@/lib/queries";
import { ProfileAvatar } from '@/components/profile-avatar';
import { useUI } from "@/lib/store";
import { getPlatform, groupByPlatform } from "@/lib/platforms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PlatformDot } from "@/components/bits";
import { DeleteProfileDialog } from "@/components/delete-profile-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/profiles")({
  head: () => ({ meta: [{ title: "Profiles · Settings · My content B/S CRM" }, { name: "description", content: "Manage your creator profiles by platform, with safe archiving and content-aware deletion." }, { property: "og:title", content: "Profiles · Settings · My content B/S CRM" }, { property: "og:description", content: "Manage your creator profiles by platform, with safe archiving and content-aware deletion." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProfilesSettings,
});

const nf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function ProfilesSettings() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: content } = useContent();
  const { data: ideas } = useIdeas();
  const { setAddProfile } = useUI();
  const [showArchived, setShowArchived] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const active = (accounts ?? []).filter((a) => !a.archived_at);
  const archived = (accounts ?? []).filter((a) => a.archived_at);
  const linked = (id: string) => [...(content ?? []), ...(ideas ?? [])].filter((c) => c.account_id === id).length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-medium">Profiles</h2>
          <p className="text-sm text-muted-foreground">
            {active.length} active, grouped by platform. Archive a profile to hide it without losing anything.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAddProfile({})}>
          <Plus className="h-4 w-4" /> Add profile
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !active.length && !archived.length ? (
        <EmptyState
          title="No profiles yet"
          hint="Paste a YouTube, Instagram, TikTok, Threads or any other profile link."
          action={<Button size="sm" onClick={() => setAddProfile({})}>Add profile</Button>}
        />
      ) : (
        groupByPlatform(active).map((g) => (
          <section key={g.platform.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <PlatformDot platform={g.platform.id} /> {g.platform.label}
                <span className="font-normal text-muted-foreground">
                  {nf.format(g.items.reduce((s, a) => s + a.followers, 0))} {g.platform.audienceLabel}
                </span>
              </h3>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => setAddProfile({ platform: g.platform.id })}>
                <Plus className="h-3.5 w-3.5" /> Add {g.platform.label}
              </Button>
            </div>
            <div className="divide-y rounded-lg border bg-card">
              {g.items.map((a) => <ProfileRow key={a.id} account={a} linked={linked(a.id)} onDelete={() => setDeleting(a)} />)}
            </div>
          </section>
        ))
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <button onClick={() => setShowArchived(!showArchived)} className="text-sm text-muted-foreground hover:text-foreground">
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && (
            <div className="divide-y rounded-lg border border-dashed">
              {archived.map((a) => <ProfileRow key={a.id} account={a} linked={linked(a.id)} onDelete={() => setDeleting(a)} />)}
            </div>
          )}
        </section>
      )}

      <DeleteProfileDialog account={deleting} linked={deleting ? linked(deleting.id) : 0} onClose={() => setDeleting(null)} />
    </div>
  );
}

function ProfileRow({ account: a, linked, onDelete }: { account: Account; linked: number; onDelete: () => void }) {
  const { openAccount, accountId, setAccountId } = useUI();
  const update = useUpdateAccount();
  const isArchived = !!a.archived_at;

  const archive = () => {
    update.mutate({ id: a.id, patch: { archived_at: new Date().toISOString() } });
    if (accountId === a.id) setAccountId(null);
    toast(`Archived “${a.name}”`, {
      description: linked ? `${linked} linked items are kept.` : undefined,
      action: { label: "Undo", onClick: () => update.mutate({ id: a.id, patch: { archived_at: null } }) },
    });
  };

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", isArchived && "opacity-70")}>
      <ProfileAvatar account={a} className="h-10 w-10" />
      <button onClick={() => openAccount(a.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{a.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {a.handle || getPlatform(a.platform).label} · {nf.format(a.followers)} {getPlatform(a.platform).audienceLabel} · {linked} linked items
        </p>
      </button>
      {a.url && (
        <a href={a.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" title="Open profile">
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${a.name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openAccount(a.id)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem onSelect={() => update.mutate({ id: a.id, patch: { archived_at: null } })}>
              <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={archive}><Archive className="mr-2 h-4 w-4" /> Archive</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

