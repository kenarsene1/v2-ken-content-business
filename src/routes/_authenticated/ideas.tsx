import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowUp, ArrowUpRight, ChevronRight, Folder, FolderInput, FolderPlus, LayoutGrid, Lightbulb, Pencil, Pin, PinOff, Plus, Rows3, Search, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent,
  ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ProfileAvatar } from '@/components/profile-avatar';
import { InlineEdit } from '@/components/inline-edit';
import { QuickAdd } from '@/components/quick-add';
import {
  useAccounts, useActiveAccounts, useCreateIdea, useCreateIdeaGroup, usePromoteIdea, useRemoveIdeaGroup, useScopedIdeaGroups, useScopedIdeas,
  useUpdateIdea, useUpdateIdeaGroup, type Account, type Idea, type IdeaGroup,
} from '@/lib/queries';
import { arrangeIdeas, cleanGroupName, countByGroup, groupsForIdea, sortGroups } from '@/lib/idea-groups';
import { afterClose, menuClass, menuDangerClass, menuItemClass } from '@/lib/menu';
import { useUI } from '@/lib/store';
import { IDEA_SOURCES, IDEA_STATUSES, ideaScore } from '@/lib/ideas';
import { labelOf } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { RefLink } from '@/components/ref-link';

export const Route = createFileRoute('/_authenticated/ideas')({
  head: () => ({ meta: [{ title: 'Video ideas · My content B/S CRM' }, { name: 'description', content: 'Capture your next creative spark, shortlist the strongest ideas, and move them into your profile’s content pipeline.' }, { property: 'og:title', content: 'Video ideas · My content B/S CRM' }, { property: 'og:description', content: 'A calm home for your content ideas, organized by creator profile.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: IdeasPage,
});

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'shortlisted', label: 'Shortlist' },
  { id: 'used', label: 'In motion' },
  { id: 'archived', label: 'Archived' },
] as const;

const control = 'h-7 gap-1.5 text-xs';

function IdeasPage() {
  const { ideasView, setIdeasView } = useUI();
  const { data: ideas, isLoading, error, refetch } = useScopedIdeas();
  const { data: accounts } = useAccounts();
  const { data: groupData } = useScopedIdeaGroups();
  const createGroup = useCreateIdeaGroup();
  const accountId = useUI((s) => s.accountId);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [tag, setTag] = useState('all');

  const inTab = (i: Idea, id: string) => (id === 'all' ? i.status !== 'archived' : i.status === id);
  const count = (id: string) => (ideas ?? []).filter((i) => inTab(i, id)).length;
  const tags = [...new Set((ideas ?? []).flatMap((i) => i.tags))].sort();
  const query = search.trim().toLowerCase();
  const rows = (ideas ?? [])
    .filter((i) => inTab(i, tab) && (tag === 'all' || i.tags.includes(tag)) && `${i.title} ${i.note ?? ''} ${i.tags.join(' ')}`.toLowerCase().includes(query))
    .sort((a, b) => (sort === 'score' ? ideaScore(b) - ideaScore(a) : b.created_at.localeCompare(a.created_at)));
  const accountOf = (idea: Idea) => accounts?.find((a) => a.id === idea.account_id);
  const filtered = !!query || tag !== 'all';

  // Groups (folders) come first and the ideas below them. Searching, filtering or the other tabs list ideas flat.
  const groups = groupData ?? [];
  const openGroup = groups.find((g) => g.id === groupId) ?? null;
  useEffect(() => {
    // The open group was removed (here or elsewhere), or belongs to another profile: back to the top level.
    if (groupId && groupData && !openGroup) setGroupId(null);
  }, [groupId, groupData, openGroup]);
  const grouping = tab === 'all' && !filtered;
  const folders = grouping && !openGroup ? sortGroups(groups) : [];
  const shown = grouping ? arrangeIdeas(rows, groups, openGroup?.id ?? null) : rows;
  const counts = countByGroup(ideas ?? []);
  const boxed = ideasView === 'cards' || !shown.length;
  const addGroup = (raw: string) => {
    const name = cleanGroupName(raw);
    if (name) {
      createGroup.mutate({ id: crypto.randomUUID(), name, account_id: accountId });
      setTab('all');
      setSearch('');
      setTag('all');
      setGroupId(null);
    }
    setAddingGroup(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3 calendar-enter">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav aria-label="Ideas location" className="flex min-w-0 items-center gap-1">
          <button type="button" onClick={() => setGroupId(null)} className={cn('text-base font-semibold', grouping && openGroup && 'text-muted-foreground hover:text-foreground')}>
            <h1 className="inline">Video ideas</h1>
          </button>
          {grouping && openGroup && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate text-base font-semibold">{openGroup.name}</span>
            </>
          )}
        </nav>
        <div className="flex items-center gap-0.5" role="group" aria-label="Idea status">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex h-6 items-center gap-1 rounded-full px-2 text-xs transition-colors',
                tab === t.id ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              <span className="tabular-nums text-[10px] text-muted-foreground">{count(t.id)}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex w-full items-center gap-1.5 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-40 sm:flex-none">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search ideas" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
          </div>
          {tags.length > 0 && (
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger aria-label="Filter ideas by tag" className={cn(control, 'w-auto', tag !== 'all' && 'border-primary/50 text-primary')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {!openGroup && (
            <Button variant="outline" size="sm" className={control} onClick={() => setAddingGroup((v) => !v)}>
              <FolderPlus className="h-3.5 w-3.5" />Group
            </Button>
          )}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort ideas" className={cn(control, 'w-auto')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="score">Best potential</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="View">
            {(['cards', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={ideasView === v}
                aria-label={v === 'cards' ? 'Card view' : 'Table view'}
                title={v === 'cards' ? 'Cards' : 'Table'}
                onClick={() => setIdeasView(v)}
                className={cn('flex h-5 w-6 items-center justify-center rounded-sm', ideasView === v ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {v === 'cards' ? <LayoutGrid className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CaptureBar group={grouping ? openGroup : null} onCaptured={() => setTab('all')} />
      {addingGroup && <QuickAdd placeholder="Group name, like AI agents or No-code" onSubmit={addGroup} onCancel={() => setAddingGroup(false)} />}

      {error ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Ideas couldn't load.</p>
          <Button variant="ghost" onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className={cn('min-h-[50vh] space-y-4', boxed && 'canvas-dots rounded-xl border p-3')}>
              {folders.length > 0 && (
                <section aria-label="Groups" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {folders.map((g) => <GroupTile key={g.id} group={g} count={counts.get(g.id) ?? 0} onOpen={() => setGroupId(g.id)} />)}
                </section>
              )}
              {!shown.length ? (
                <div className={cn('flex flex-col items-center justify-center text-center', folders.length ? 'py-10' : 'min-h-[44vh]')}>
                  <Lightbulb className="mb-2 h-5 w-5 text-primary/60" />
                  <p className="text-sm font-medium">
                    {filtered ? 'No matching ideas' : openGroup ? 'This group is empty' : tab === 'shortlisted' ? 'Star your best ideas to shortlist them' : tab === 'used' ? 'Ideas you send to Working on show here' : tab === 'archived' ? 'Nothing archived' : folders.length ? 'No loose ideas' : 'Your ideas live here'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filtered ? 'Try another search or tag.' : openGroup ? 'Type an idea above and it lands in this group.' : tab === 'all' ? 'Type one above and press Enter. Right-click here to add a group.' : ''}
                  </p>
                </div>
              ) : ideasView === 'table' ? (
                <IdeaTable rows={shown} accountOf={accountOf} groups={groups} />
              ) : (
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {shown.map((idea) => <IdeaCard key={idea.id} idea={idea} account={accountOf(idea)} groups={groups} />)}
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className={menuClass} onCloseAutoFocus={(e) => e.preventDefault()}>
            {openGroup ? (
              <ContextMenuItem className={menuItemClass} onSelect={() => setGroupId(null)}><ChevronRight className="rotate-180" /> Back to all ideas</ContextMenuItem>
            ) : (
              <ContextMenuItem className={menuItemClass} onSelect={afterClose(() => setAddingGroup(true))}><FolderPlus /> New group</ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  );
}

/** One-line capture: type, press Enter. */
function CaptureBar({ group, onCaptured }: { group: IdeaGroup | null; onCaptured: () => void }) {
  const accountId = useUI((s) => s.accountId);
  const { data: active } = useActiveAccounts();
  const create = useCreateIdea();
  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState('none');

  const capture = async () => {
    if (!title.trim()) return;
    // Inside a group the idea joins it and shares its profile.
    const account_id = group ? group.account_id : (accountId ?? (profile === 'none' ? null : profile));
    await create.mutateAsync(group ? { title: title.trim(), account_id, group_id: group.id } : { title: title.trim(), account_id });
    setTitle('');
    onCaptured();
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void capture(); }}
      className="flex h-10 items-center gap-2 rounded-lg border bg-card pl-3 pr-1.5 focus-within:border-primary/40"
    >
      <Plus className="h-4 w-4 shrink-0 text-primary" />
      <input
        aria-label="New idea title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={group ? `Capture an idea in ${group.name}…` : 'Capture an idea…'}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {!accountId && !group && (
        <Select value={profile} onValueChange={setProfile}>
          <SelectTrigger aria-label="Capture profile" className="h-7 w-auto max-w-36 gap-1.5 border-0 bg-muted/60 text-xs shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No profile</SelectItem>
            {active?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex items-center gap-2"><ProfileAvatar account={a} className="h-4 w-4" />{a.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button type="submit" size="icon" className="h-7 w-7 shrink-0" title="Capture idea" aria-label="Capture idea" disabled={!title.trim() || create.isPending}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}

/** Shortlist and send-to-Next-video actions, shared by cards and table rows. */
function useIdeaActions(idea: Idea) {
  const openContent = useUI((s) => s.openContent);
  const update = useUpdateIdea();
  const promote = usePromoteIdea();
  return {
    shortlisted: idea.status === 'shortlisted',
    toggleShortlist: () => update.mutate({ id: idea.id, patch: { status: idea.status === 'shortlisted' ? 'new' : 'shortlisted' } }),
    sending: promote.isPending,
    send: () => {
      if (idea.content_item_id) openContent(idea.content_item_id);
      else promote.mutate(idea.id, { onSuccess: (id) => openContent(id) });
    },
    sendLabel: `${idea.content_item_id ? 'Open' : 'Send'} ${idea.title} ${idea.content_item_id ? 'in' : 'to'} Working on`,
  };
}

function ShortlistButton({ idea, className }: { idea: Idea; className?: string }) {
  const { shortlisted, toggleShortlist } = useIdeaActions(idea);
  return (
    <button
      type="button"
      aria-label={`Shortlist ${idea.title}`}
      aria-pressed={shortlisted}
      title={shortlisted ? 'Remove from shortlist' : 'Shortlist'}
      disabled={idea.status === 'used'}
      onClick={toggleShortlist}
      className={cn(
        'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted disabled:opacity-40',
        shortlisted ? 'text-primary' : 'text-muted-foreground',
        className,
      )}
    >
      <Star className={cn('h-3.5 w-3.5', shortlisted && 'fill-current')} />
    </button>
  );
}

function SendButton({ idea, className }: { idea: Idea; className?: string }) {
  const { send, sending, sendLabel } = useIdeaActions(idea);
  return (
    <button
      type="button"
      aria-label={sendLabel}
      title={idea.content_item_id ? 'Open in Working on' : 'Send to Working on'}
      disabled={sending}
      onClick={send}
      className={cn('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary', className)}
    >
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  );
}

function IdeaCard({ idea, account, groups }: { idea: Idea; account: Account | undefined; groups: IdeaGroup[] }) {
  const openIdea = useUI((s) => s.openIdea);
  const quiet = 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100';
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <article
      className={cn(
        'group relative flex min-h-24 min-w-0 flex-col rounded-lg border bg-card p-3 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm motion-reduce:transform-none',
        idea.status === 'archived' && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => openIdea(idea.id)}
          className="min-w-0 flex-1 break-words text-left text-sm font-medium leading-snug after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {idea.title}
        </button>
        <ShortlistButton idea={idea} className={cn(idea.status !== 'shortlisted' && quiet)} />
      </div>
      {idea.note && <p className="mt-1 line-clamp-3 break-words text-xs leading-relaxed text-muted-foreground">{idea.note}</p>}
      <div className="mt-auto flex items-center gap-1.5 pt-3 text-[11px] text-muted-foreground">
        {account && <ProfileAvatar account={account} className="h-4 w-4 shrink-0" />}
        {idea.content_item_id && <span className="shrink-0 text-primary">In Working on</span>}
        <RefLink url={idea.ref_url} />
        <span className="flex min-w-0 gap-1 overflow-hidden">
          {idea.tags.slice(0, 2).map((t) => <span key={t} className="truncate">#{t}</span>)}
        </span>
        <span className="ml-auto shrink-0 tabular-nums" title="Potential: reach × ease × niche fit (max 125)">{ideaScore(idea)}</span>
        <SendButton idea={idea} className={cn(!idea.content_item_id && quiet)} />
      </div>
    </article>
      </ContextMenuTrigger>
      <IdeaMenu idea={idea} groups={groups} />
    </ContextMenu>
  );
}

/** Right-click menu for an idea: open, shortlist and move between groups. */
function IdeaMenu({ idea, groups }: { idea: Idea; groups: IdeaGroup[] }) {
  const openIdea = useUI((s) => s.openIdea);
  const { shortlisted, toggleShortlist } = useIdeaActions(idea);
  const update = useUpdateIdea();
  const options = groupsForIdea(groups, idea);
  const move = (group_id: string | null) => update.mutate({ id: idea.id, patch: { group_id } });
  return (
    <ContextMenuContent className={menuClass} onCloseAutoFocus={(e) => e.preventDefault()}>
      <ContextMenuItem className={menuItemClass} onSelect={() => openIdea(idea.id)}><Pencil /> Open & edit</ContextMenuItem>
      <ContextMenuItem className={menuItemClass} disabled={idea.status === 'used'} onSelect={toggleShortlist}>
        <Star /> {shortlisted ? 'Remove from shortlist' : 'Shortlist'}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger className={menuItemClass}><FolderInput /> Move to group</ContextMenuSubTrigger>
        <ContextMenuSubContent className="max-h-64 w-48 overflow-y-auto">
          <ContextMenuItem className={menuItemClass} disabled={!idea.group_id} onSelect={() => move(null)}>No group</ContextMenuItem>
          {sortGroups(options).map((g) => (
            <ContextMenuItem key={g.id} className={menuItemClass} disabled={g.id === idea.group_id} onSelect={() => move(g.id)}>
              <Folder /> <span className="truncate">{g.name}</span>
            </ContextMenuItem>
          ))}
          {!options.length && <ContextMenuItem className={menuItemClass} disabled>No groups yet</ContextMenuItem>}
        </ContextMenuSubContent>
      </ContextMenuSub>
    </ContextMenuContent>
  );
}

/** A group (folder) of ideas. Right-click to rename, pin or remove it. */
function GroupTile({ group, count, onOpen }: { group: IdeaGroup; count: number; onOpen: () => void }) {
  const update = useUpdateIdeaGroup();
  const remove = useRemoveIdeaGroup();
  const [renaming, setRenaming] = useState(false);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group relative flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/30 motion-reduce:transform-none">
          <Folder className="h-4 w-4 shrink-0 fill-primary/15 text-primary" />
          {renaming ? (
            <InlineEdit
              label="Group name"
              value={group.name}
              className="min-w-0 flex-1 text-xs"
              onSave={(v) => { const name = cleanGroupName(v); if (name) update.mutate({ id: group.id, patch: { name } }); }}
              onDone={() => setRenaming(false)}
            />
          ) : (
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-xs font-medium after:absolute after:inset-0">
              {group.name}
            </button>
          )}
          {group.pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-primary" aria-label="Pinned" />}
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{count}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menuClass} onCloseAutoFocus={(e) => e.preventDefault()}>
        <ContextMenuItem className={menuItemClass} onSelect={onOpen}><Folder /> Open</ContextMenuItem>
        <ContextMenuItem className={menuItemClass} onSelect={afterClose(() => setRenaming(true))}><Pencil /> Rename</ContextMenuItem>
        <ContextMenuItem className={menuItemClass} onSelect={() => update.mutate({ id: group.id, patch: { pinned: !group.pinned } })}>
          {group.pinned ? <PinOff /> : <Pin />} {group.pinned ? 'Unpin' : 'Pin to front'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className={menuDangerClass} onSelect={() => remove(group)}><Trash2 /> Remove group</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function IdeaTable({ rows, accountOf, groups }: { rows: Idea[]; accountOf: (idea: Idea) => Account | undefined; groups: IdeaGroup[] }) {
  const openIdea = useUI((s) => s.openIdea);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 min-w-64 text-xs">Idea</TableHead>
            <TableHead className="h-8 text-xs">Profile</TableHead>
            <TableHead className="h-8 text-xs">Tags</TableHead>
            <TableHead className="h-8 text-xs">Source</TableHead>
            <TableHead className="h-8 text-xs">Status</TableHead>
            <TableHead className="h-8 text-right text-xs" title="Reach × ease × niche fit (max 125)">Potential</TableHead>
            <TableHead className="h-8 w-16"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((idea) => {
            const account = accountOf(idea);
            return (
              <ContextMenu key={idea.id}>
              <ContextMenuTrigger asChild>
              <TableRow className={cn('group', idea.status === 'archived' && 'opacity-60')}>
                <TableCell className="max-w-md py-2">
                  <span className="flex max-w-full items-center gap-1.5">
                    <button type="button" onClick={() => openIdea(idea.id)} className="min-w-0 text-left text-[13px] font-medium hover:underline">
                      {idea.title}
                    </button>
                    <RefLink url={idea.ref_url} />
                  </span>
                  {idea.note && <span className="block truncate text-[11px] text-muted-foreground">{idea.note}</span>}
                </TableCell>
                <TableCell className="py-2 text-muted-foreground">
                  {account ? (
                    <span className="flex items-center gap-1.5 whitespace-nowrap"><ProfileAvatar account={account} className="h-4 w-4" />{account.name}</span>
                  ) : '—'}
                </TableCell>
                <TableCell className="py-2 text-muted-foreground">{idea.tags.length ? idea.tags.map((t) => `#${t}`).join(' ') : '—'}</TableCell>
                <TableCell className="whitespace-nowrap py-2 text-muted-foreground">{labelOf(IDEA_SOURCES, idea.source)}</TableCell>
                <TableCell className="whitespace-nowrap py-2 text-muted-foreground">{labelOf(IDEA_STATUSES, idea.status)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{ideaScore(idea)}</TableCell>
                <TableCell className="py-2">
                  <span className="flex justify-end gap-0.5">
                    <ShortlistButton idea={idea} />
                    <SendButton idea={idea} />
                  </span>
                </TableCell>
              </TableRow>
              </ContextMenuTrigger>
              <IdeaMenu idea={idea} groups={groups} />
              </ContextMenu>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
