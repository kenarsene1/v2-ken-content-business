import { ArrowUpRight, Archive, Star, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { AutoInput, Field } from './bits';
import { ProfileAvatar } from './profile-avatar';
import { LinkField } from './ref-link';
import { useAccounts, useIdeaGroups, useIdeas, useUpdateIdea, usePromoteIdea, useDeleteWithUndo } from '@/lib/queries';
import { groupsForIdea, sortGroups } from '@/lib/idea-groups';
import { useUI } from '@/lib/store';
import { IDEA_SOURCES, IDEA_STATUSES, ideaScore } from '@/lib/ideas';

export function IdeaDrawer() {
  const { openIdeaId, openIdea, openContent } = useUI();
  const { data: ideas } = useIdeas();
  const { data: allAccounts } = useAccounts();
  const { data: allGroups } = useIdeaGroups();
  const update = useUpdateIdea(); const promote = usePromoteIdea(); const del = useDeleteWithUndo();
  const idea = ideas?.find((i) => i.id === openIdeaId);
  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) => { if (idea) update.mutate({ id: idea.id, patch }); };
  return <Sheet open={!!openIdeaId} onOpenChange={(open) => { if (!open) openIdea(null); }}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetTitle className="sr-only">Content idea</SheetTitle>
      {idea && <div className="space-y-7 pb-10">
        <div className="pr-8"><p className="mb-3 text-xs font-medium text-primary">A little spark</p><AutoInput key={idea.id} value={idea.title} className="-ml-2 text-xl font-semibold" onSave={(title) => save({ title: title.trim() || 'Untitled idea' })} /></div>
        <div className="space-y-1">
          <Field label="Profile"><Select value={idea.account_id ?? 'none'} disabled={!!idea.content_item_id} onValueChange={(id) => save({ account_id: id === 'none' ? null : id, ...(idea.group_id ? { group_id: null } : {}) })}><SelectTrigger aria-label="Idea profile" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No profile</SelectItem>
            {allAccounts?.filter((a) => !a.archived_at || a.id === idea.account_id).map((a) => <SelectItem key={a.id} value={a.id}><span className="flex items-center gap-2"><ProfileAvatar account={a} className="h-5 w-5" />{a.name}{a.archived_at ? ' (archived)' : ''}</span></SelectItem>)}
          </SelectContent></Select></Field>
          <Field label="Group"><Select value={idea.group_id ?? 'none'} onValueChange={(id) => save({ group_id: id === 'none' ? null : id })}><SelectTrigger aria-label="Idea group" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No group</SelectItem>
            {sortGroups(groupsForIdea(allGroups ?? [], idea)).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent></Select></Field>
          <Field label="Status"><Select value={idea.status} onValueChange={(status) => save({ status })}><SelectTrigger aria-label="Idea status" className="h-9"><SelectValue /></SelectTrigger><SelectContent>{IDEA_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Source"><Select value={idea.source} onValueChange={(source) => save({ source })}><SelectTrigger aria-label="Idea source" className="h-9"><SelectValue /></SelectTrigger><SelectContent>{IDEA_SOURCES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Reference"><LinkField label="Reference" value={idea.ref_url} placeholder="Link to a post that inspired this" onSave={(ref_url) => save({ ref_url })} /></Field>
          <Field label="Tags"><AutoInput value={idea.tags.join(', ')} placeholder="tech, storytelling…" onSave={(v) => save({ tags: [...new Set(v.split(',').map((t) => t.trim()).filter(Boolean))] })} /></Field>
        </div>
        <section><h3 className="mb-2 text-sm font-medium">The thought behind it</h3><AutoInput multiline value={idea.note} placeholder="The hook, a rough angle, a link worth keeping…" onSave={(note) => save({ note })} /></section>
        <section className="space-y-5 border-t pt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">Potential</h3><span className="text-sm font-semibold text-primary">{ideaScore(idea)}<span className="font-normal text-muted-foreground"> / 125</span></span></div>
          {([{ key: 'reach', label: 'Audience reach' }, { key: 'ease', label: 'Easy to create' }, { key: 'relevance', label: 'Fits my niche' }] as const).map(({ key, label }) => <div key={key} className="space-y-2"><div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{idea[key]} / 5</span></div><Slider aria-label={label} value={[idea[key]]} min={1} max={5} step={1} onValueChange={([value]) => { if (value !== undefined) save({ [key]: value }); }} /></div>)}
        </section>
        <div className="flex flex-wrap gap-2 border-t pt-5"><Button className="gap-1.5" disabled={promote.isPending} onClick={() => { const show = (id: string) => { openIdea(null); openContent(id); }; if (idea.content_item_id) show(idea.content_item_id); else promote.mutate(idea.id, { onSuccess: show }); }}><ArrowUpRight className="h-4 w-4" />{idea.content_item_id ? 'Open in Working on' : 'Send to Working on'}</Button>
          {!idea.content_item_id && <Button variant="outline" size="icon" title={idea.status === 'shortlisted' ? 'Remove from shortlist' : 'Shortlist'} aria-label="Toggle shortlist" onClick={() => save({ status: idea.status === 'shortlisted' ? 'new' : 'shortlisted' })}><Star className={idea.status === 'shortlisted' ? 'fill-current text-primary' : ''} /></Button>}
          <Button variant="ghost" size="icon" title={idea.status === 'archived' ? 'Restore idea' : 'Archive idea'} aria-label="Toggle archive" onClick={() => save({ status: idea.status === 'archived' ? (idea.content_item_id ? 'used' : 'new') : 'archived' })}><Archive /></Button>
          <Button variant="ghost" size="icon" className="text-destructive" title="Delete idea" aria-label="Delete idea" onClick={() => { openIdea(null); del('ideas', idea, idea.title); }}><Trash2 /></Button>
        </div>
      </div>}
    </SheetContent>
  </Sheet>;
}