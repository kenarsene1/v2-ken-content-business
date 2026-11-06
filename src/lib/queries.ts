import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { REPURPOSE_TARGETS } from "./constants";
import { useUI } from "./store";
import { scopeToAccount } from './ideas';
import { dealsAsIncome } from './revenue';
import { sponsorsByVideo } from './deals';
import { byManualOrder, orderPatches } from './deal-order';
import { fetchAll } from './fetch-all';
import { PendingChanges, RowQueue } from './optimistic-list';
import type { DealTask } from './deal-tasks';
import { publicationPatch } from './publication';
import { challengeHistory, challengeProgress, periodKey, type Challenge } from './challenges';
import type { Goal } from './goals';
import { parseWorkflow, WORKFLOW, type Workflow, type WorkflowStep } from './workflow';
import { DEFAULT_STAGES, parseStages, type Stage, type StageList } from './stages';
import { safeFileName } from './library';
import { clearDraft, draftTable, isBlankDraft, type DraftTable } from './drafts';

export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Idea = Database['public']['Tables']['ideas']['Row'];
export type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
export type ChecklistItem = Database["public"]["Tables"]["content_checklist_items"]["Row"];
export type AccountPatch = Database["public"]["Tables"]["accounts"]["Update"];
type ContentPatch = Database["public"]["Tables"]["content_items"]["Update"];
type ContentInsert = Database["public"]["Tables"]["content_items"]["Insert"];

export const keys = {
  accounts: ["accounts"] as const,
  content: ["content"] as const,
  checklist: ["checklist"] as const,
  ideas: ['ideas'] as const,
  challenges: ['challenges'] as const,
  goals: ['goals'] as const,
  dealTasks: ['deal_tasks'] as const,
  workflow: ['workflow'] as const,
  libraryItems: ['library_items'] as const,
  libraryProjects: ['library_projects'] as const,
  ideaGroups: ['idea_groups'] as const,
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

/** Every cached table. Deletes cascade (or unlink) across tables, so they refresh all of them. */
const ALL_KEYS = [["accounts"], ["content"], ["checklist"], ["ideas"], ["deals"], ["deal_tasks"], ["deal_groups"], ["revenue"], ["challenges"], ["goals"], ["workflow"], ["library_items"], ["library_projects"], ["idea_groups"]] as const;
function refreshAll(qc: ReturnType<typeof useQueryClient>) {
  for (const queryKey of ALL_KEYS) qc.invalidateQueries({ queryKey });
}

/* ---------- Accounts ---------- */
export function useAccounts() {
  const query = useQuery({
    queryKey: keys.accounts,
    queryFn: async () => fetchAll((from, to) => supabase.from("accounts").select("*").order("sort_order").order("created_at").order('id').range(from, to)),
  });
  const accountId = useUI((s) => s.accountId);
  useEffect(() => {
    if (query.isSuccess && accountId && !query.data.some((a) => a.id === accountId && !a.archived_at)) {
      useUI.getState().setAccountId(null);
    }
  }, [query.data, query.isSuccess, accountId]);
  return query;
}

/** Validate against current owner-visible profiles, not persisted browser selection. */
async function validateCreationProfile<T extends { account_id?: string | null }>(input: T): Promise<T> {
  if (!input.account_id) return input;
  const { data: account, error } = await supabase.from("accounts").select("*").eq("id", input.account_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!account || account.archived_at) {
    if (useUI.getState().accountId === input.account_id) useUI.getState().setAccountId(null);
    throw new Error("This profile is no longer available. Choose an active profile or All accounts and try again.");
  }
  return input;
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["accounts"]["Insert"] = {}): Promise<Account> =>
      unwrap(await supabase.from("accounts").insert(input).select().single()) as Account,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.accounts }),
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AccountPatch }) =>
      unwrap(await supabase.from("accounts").update(patch).eq("id", id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.accounts });
      const prev = qc.getQueryData<Account[]>(keys.accounts);
      qc.setQueryData<Account[]>(keys.accounts, (old) => old?.map((a) => (a.id === id ? { ...a, ...patch } as Account : a)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.accounts, ctx?.prev);
      toast.error(e.message);
    },
  });
}

/* ---------- Content ---------- */
export function useContent() {
  return useQuery({
    queryKey: keys.content,
    queryFn: async () => fetchAll((from, to) => supabase.from("content_items").select("*").order("position").order('id').range(from, to)),
  });
}

/**
 * Content for the profile picked in the sidebar ("All accounts" = everything).
 * Use this on every page so a profile only ever shows its own data.
 */
export function useScopedContent() {
  const q = useContent();
  const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}

export function useChecklist() {
  return useQuery({
    queryKey: keys.checklist,
    queryFn: async () => fetchAll((from, to) => supabase.from("content_checklist_items").select("*").order("position").order('id').range(from, to)),
  });
}

export function useCreateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContentInsert): Promise<ContentItem> =>
      unwrap(await supabase.from("content_items").insert({ position: Date.now(), ...await validateCreationProfile(input) }).select().single()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.content });
      qc.invalidateQueries({ queryKey: keys.checklist });
    },
    onError: (e) => toast.error(e.message),
  });
}

/** Marking content published moves its publish date to now unless it already went out earlier. */
export function withPublishDate(item: ContentItem | undefined, patch: ContentPatch): ContentPatch {
  return publicationPatch(item, patch);
}

export function useUpdateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ContentPatch }) =>
      unwrap(await supabase.from("content_items").update(withPublishDate(qc.getQueryData<ContentItem[]>(keys.content)?.find((c) => c.id === id), patch)).eq("id", id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.content });
      const prev = qc.getQueryData<ContentItem[]>(keys.content);
      qc.setQueryData<ContentItem[]>(keys.content, (old) =>
        old?.map((c) => (c.id === id ? ({ ...c, ...withPublishDate(c, patch) } as ContentItem) : c)),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.content, ctx?.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.content }),
  });
}

/** Optimistic delete with a 5s undo window before the row is really removed. */
export function useDeleteWithUndo() {
  const qc = useQueryClient();
  return (table: "content_items" | "accounts" | "ideas" | "challenges" | "goals", row: { id: string }, label: string) => {
    const key = table === "content_items" ? keys.content : table === 'ideas' ? keys.ideas : table === "challenges" ? keys.challenges : table === "goals" ? keys.goals : keys.accounts;
    const prev = qc.getQueryData<{ id: string }[]>(key);
    qc.setQueryData<{ id: string }[]>(key, (old) => old?.filter((r) => r.id !== row.id));
    if (table === "content_items") {
      qc.setQueryData<BrandDeal[]>(["deals"], (o) => o?.map((d) => (d.content_item_id === row.id ? { ...d, content_item_id: null } : d)));
      qc.setQueryData<Idea[]>(keys.ideas, (o) => o?.map((i) => (i.content_item_id === row.id ? { ...i, content_item_id: null } : i)));
    }
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      const { error } = await supabase.from(table).delete().eq("id", row.id);
      if (error) {
        toast.error(error.message);
        qc.setQueryData(key, prev);
      }
      refreshAll(qc);
    }, 5000);
    toast(`Deleted “${label}”`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          qc.setQueryData(key, prev);
        },
      },
    });
  };
}

export function useToggleChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      unwrap(await supabase.from("content_checklist_items").update({ done }).eq("id", id).select().single()),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: keys.checklist });
      const prev = qc.getQueryData<ChecklistItem[]>(keys.checklist);
      qc.setQueryData<ChecklistItem[]>(keys.checklist, (old) => old?.map((c) => (c.id === id ? { ...c, done } : c)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.checklist, ctx?.prev);
      toast.error(e.message);
    },
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content_item_id, label, position }: { content_item_id: string; label: string; position: number }) =>
      unwrap(await supabase.from("content_checklist_items").insert({ content_item_id, label, position }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.checklist }),
  });
}

export function useRepurpose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, accounts }: { item: ContentItem; accounts: Account[] }) => {
      const rows: ContentInsert[] = REPURPOSE_TARGETS.map((t, i) => ({
        parent_id: item.id,
        title: `${item.title} (${t.suffix})`,
        format: t.format,
        platforms: [t.platform],
        stage: "idea",
        priority: item.priority,
        tags: item.tags,
        account_id:
          accounts.find((a) => a.platform === t.platform && a.id !== item.account_id)?.id ??
          accounts.find((a) => a.platform === t.platform)?.id ??
          null,
        position: Date.now() + i,
      }));
      await Promise.all(rows.map(validateCreationProfile));
      return unwrap(await supabase.from("content_items").insert(rows).select());
    },
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: keys.content });
      qc.invalidateQueries({ queryKey: keys.checklist });
      toast.success(`Created ${rows.length} linked cards for Shorts, Reels and TikTok`);
    },
    onError: (e) => toast.error(e.message),
  });
}

/** Profiles that are not archived — use for pickers and the sidebar filter. */
export function useActiveAccounts() {
  const q = useAccounts();
  return { ...q, data: q.data?.filter((a) => !a.archived_at) };
}

/**
 * Delete a profile with a 5s undo window.
 * mode "unassign" keeps linked content (moves it to "No profile"); "delete" removes it too.
 */
export function useDeleteProfile() {
  const qc = useQueryClient();
  return (account: Account, mode: "unassign" | "delete") => {
    const prevA = qc.getQueryData<Account[]>(keys.accounts);
    const prevC = qc.getQueryData<ContentItem[]>(keys.content);
    const prevI = qc.getQueryData<Idea[]>(keys.ideas);
    qc.setQueryData<Idea[]>(keys.ideas, (old) => mode === 'delete' ? old?.filter((i) => i.account_id !== account.id) : old?.map((i) => i.account_id === account.id ? { ...i, account_id: null } : i));
    qc.setQueryData<Account[]>(keys.accounts, (old) => old?.filter((a) => a.id !== account.id));
    qc.setQueryData<ContentItem[]>(keys.content, (old) =>
      mode === "delete"
        ? old?.filter((c) => c.account_id !== account.id)
        : old?.map((c) => (c.account_id === account.id ? { ...c, account_id: null } : c)),
    );
    if (useUI.getState().accountId === account.id) useUI.getState().setAccountId(null);
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      const res = await supabase.rpc('delete_creator_profile', { _account_id: account.id, _delete_linked: mode === 'delete' });
      if (res.error) {
        toast.error(res.error.message);
        qc.setQueryData(keys.accounts, prevA);
        qc.setQueryData(keys.content, prevC);
        qc.setQueryData(keys.ideas, prevI);
      }
      refreshAll(qc);
    }, 5000);
    toast(`Deleted “${account.name}”`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          qc.setQueryData(keys.accounts, prevA);
          qc.setQueryData(keys.content, prevC);
          qc.setQueryData(keys.ideas, prevI);
        },
      },
    });
  };
}

/* ---------- Ideas ---------- */
export function useIdeas() {
  return useQuery({ queryKey: keys.ideas, queryFn: async () => fetchAll((from, to) => supabase.from('ideas').select('*').order('created_at', { ascending: false }).order('id').range(from, to)) });
}
export function useScopedIdeas() {
  const q = useIdeas(); const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}
export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Database['public']['Tables']['ideas']['Insert']): Promise<Idea> => unwrap(await supabase.from('ideas').insert(await validateCreationProfile(input)).select().single()), onSuccess: () => qc.invalidateQueries({ queryKey: keys.ideas }), onError: (e) => toast.error(e.message) });
}
export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, patch }: { id: string; patch: Database['public']['Tables']['ideas']['Update'] }) => unwrap(await supabase.from('ideas').update(patch).eq('id', id).select().single()),
    onMutate: async ({ id, patch }) => { await qc.cancelQueries({ queryKey: keys.ideas }); const prev = qc.getQueryData<Idea[]>(keys.ideas); qc.setQueryData<Idea[]>(keys.ideas, (old) => old?.map((i) => i.id === id ? { ...i, ...patch } as Idea : i)); return { prev }; },
    onError: (e, _v, ctx) => { qc.setQueryData(keys.ideas, ctx?.prev); toast.error(e.message); },
  });
}
export function usePromoteIdea() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => {
    const contentId = unwrap(await supabase.rpc('promote_idea', { _idea_id: id }));
    const ref = qc.getQueryData<Idea[]>(keys.ideas)?.find((i) => i.id === id)?.ref_url;
    if (ref) await supabase.from('content_items').update({ ref_url: ref }).eq('id', contentId).is('ref_url', null);
    return contentId;
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: keys.ideas }); qc.invalidateQueries({ queryKey: keys.content }); qc.invalidateQueries({ queryKey: keys.checklist }); toast.success('An idea in motion ✨'); }, onError: (e) => toast.error(e.message) });
}

/* ---------- Brand deals ---------- */
export type BrandDeal = Database['public']['Tables']['brand_deals']['Row'];
export type DealGroup = Database['public']['Tables']['deal_groups']['Row'];
type DealPatch = Database['public']['Tables']['brand_deals']['Update'];
const dealKeys = { deals: ['deals'] as const, groups: ['deal_groups'] as const };
export { dealKeys };

export function useDeals() {
  return useQuery({ queryKey: dealKeys.deals, queryFn: async () => fetchAll((from, to) => supabase.from('brand_deals').select('*').order('sort_order').order('created_at', { ascending: false }).order('id').range(from, to)) });
}
/** Deals for the profile picked in the sidebar ("All accounts" = everything). */
/** Built once per deals fetch and shared by every caller, so per-card lookups stay cheap. */
const sponsorCache = new WeakMap<BrandDeal[], Map<string, string>>();
const NO_SPONSORS = new Map<string, string>();

/** Sponsor brand per video id ("sponsored" = linked to a brand deal that isn't lost). */
export function useSponsors(): ReadonlyMap<string, string> {
  const { data } = useDeals();
  if (!data) return NO_SPONSORS;
  let map = sponsorCache.get(data);
  if (!map) sponsorCache.set(data, (map = sponsorsByVideo(data)));
  return map;
}

export function useScopedDeals() {
  const q = useDeals(); const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}
export function useDealGroups() {
  return useQuery({ queryKey: dealKeys.groups, queryFn: async () => fetchAll((from, to) => supabase.from('deal_groups').select('*').order('sort_order').order('created_at').order('id').range(from, to)) });
}
export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['brand_deals']['Insert']): Promise<BrandDeal> => unwrap(await supabase.from('brand_deals').insert(await validateCreationProfile(input)).select().single()),
    onSuccess: (row) => qc.setQueryData<BrandDeal[]>(dealKeys.deals, (old) => [row, ...(old ?? [])].sort(byManualOrder)),
    onError: (e) => toast.error(e.message),
  });
}
/** Saves a new manual order: only deals whose position changed are written. */
export function useReorderDeals() {
  const qc = useQueryClient();
  // Saved positions from before the optimistic screen update. The write runs after that
  // update, so this is the only copy of "what was in the database" that shows real moves.
  const savedBefore = useRef<Map<string, number>>(new Map());
  return useMutation<void, Error, string[], { prev: BrandDeal[] | undefined }>({
    mutationFn: async (ids) => {
      for (const res of await Promise.all(orderPatches(savedBefore.current, ids).map((p) => supabase.from('brand_deals').update({ sort_order: p.sort_order }).eq('id', p.id)))) {
        if (res.error) throw new Error(res.error.message);
      }
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: dealKeys.deals });
      const prev = qc.getQueryData<BrandDeal[]>(dealKeys.deals);
      savedBefore.current = new Map((prev ?? []).map((d) => [d.id, d.sort_order]));
      const pos = new Map(ids.map((id, i) => [id, i]));
      qc.setQueryData<BrandDeal[]>(dealKeys.deals, (old) => old?.map((d) => (pos.has(d.id) ? { ...d, sort_order: pos.get(d.id) as number } : d)).sort(byManualOrder));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(dealKeys.deals, ctx?.prev); toast.error(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: dealKeys.deals }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: DealPatch }) => unwrap(await supabase.from('brand_deals').update(patch).eq('id', id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: dealKeys.deals });
      const prev = qc.getQueryData<BrandDeal[]>(dealKeys.deals);
      qc.setQueryData<BrandDeal[]>(dealKeys.deals, (old) => old?.map((d) => (d.id === id ? ({ ...d, ...patch } as BrandDeal) : d)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(dealKeys.deals, ctx?.prev); toast.error(e.message); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: dealKeys.deals });
      qc.invalidateQueries({ queryKey: revenueKey });
    },
  });
}
export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string; sort_order?: number }): Promise<DealGroup> => unwrap(await supabase.from('deal_groups').insert(input).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: dealKeys.groups }),
    onError: (e) => toast.error(e.message),
  });
}
export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Database['public']['Tables']['deal_groups']['Update'] }) => unwrap(await supabase.from('deal_groups').update(patch).eq('id', id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: dealKeys.groups });
      const prev = qc.getQueryData<DealGroup[]>(dealKeys.groups);
      qc.setQueryData<DealGroup[]>(dealKeys.groups, (old) => old?.map((g) => (g.id === id ? ({ ...g, ...patch } as DealGroup) : g)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(dealKeys.groups, ctx?.prev); toast.error(e.message); },
  });
}
/** Optimistic delete with undo. Deals inside a deleted group are kept (moved to "No group"). */
export function useDeleteDealOrGroup() {
  const qc = useQueryClient();
  return (kind: 'deal' | 'group', row: { id: string }, label: string) => {
    const prevD = qc.getQueryData<BrandDeal[]>(dealKeys.deals);
    const prevG = qc.getQueryData<DealGroup[]>(dealKeys.groups);
    const prevR = qc.getQueryData<RevenueEntry[]>(revenueKey);
    const linkedRevenue = kind === 'deal' ? prevD?.find(d => d.id === row.id)?.revenue_entry_id : null;
    if (linkedRevenue) qc.setQueryData<RevenueEntry[]>(revenueKey, old => old?.filter(r => r.id !== linkedRevenue));
    if (kind === 'deal') qc.setQueryData<BrandDeal[]>(dealKeys.deals, (o) => o?.filter((d) => d.id !== row.id));
    else {
      qc.setQueryData<DealGroup[]>(dealKeys.groups, (o) => o?.filter((g) => g.id !== row.id));
      qc.setQueryData<BrandDeal[]>(dealKeys.deals, (o) => o?.map((d) => (d.group_id === row.id ? { ...d, group_id: null } : d)));
    }
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      const { error } = await supabase.from(kind === 'deal' ? 'brand_deals' : 'deal_groups').delete().eq('id', row.id);
      if (error) { toast.error(error.message); qc.setQueryData(dealKeys.deals, prevD); qc.setQueryData(dealKeys.groups, prevG); if (linkedRevenue) qc.setQueryData(revenueKey, prevR); }
      refreshAll(qc);
    }, 5000);
    toast(`Deleted “${label}”`, { duration: 5000, action: { label: 'Undo', onClick: () => { undone = true; clearTimeout(timer); qc.setQueryData(dealKeys.deals, prevD); qc.setQueryData(dealKeys.groups, prevG); if (linkedRevenue) qc.setQueryData(revenueKey, prevR); } } });
  };
}

/* ---------- Revenue & expenses ---------- */
export type RevenueEntry = Database['public']['Tables']['revenue_entries']['Row'];
type RevenueInsert = Database['public']['Tables']['revenue_entries']['Insert'];
const revenueKey = ['revenue'] as const;
export { revenueKey };

export function useRevenue() {
  return useQuery({ queryKey: revenueKey, queryFn: async () => fetchAll((from, to) => supabase.from('revenue_entries').select('*').order('entry_date', { ascending: false }).order('id').range(from, to)) });
}
/** Manual entries + paid brand deals, scoped to the selected profile. */
export function useScopedMoney() {
  const r = useRevenue(); const d = useDeals(); const accountId = useUI((s) => s.accountId);
  const data = r.data && d.data ? scopeToAccount([...r.data.map((x) => ({ ...x, amount: Number(x.amount) })), ...dealsAsIncome(d.data)], accountId) : undefined;
  return { data, isLoading: r.isLoading || d.isLoading };
}
export function useCreateRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RevenueInsert): Promise<RevenueEntry> => unwrap(await supabase.from('revenue_entries').insert(await validateCreationProfile(input)).select().single()),
    onSuccess: (row) => {
      qc.setQueryData<RevenueEntry[]>(revenueKey, (old) => [row, ...(old ?? [])]);
      qc.invalidateQueries({ queryKey: dealKeys.deals });
    },
    onError: (e) => toast.error(e.message),
  });
}
export function useUpdateRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Database['public']['Tables']['revenue_entries']['Update'] }) => unwrap(await supabase.from('revenue_entries').update(patch).eq('id', id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: revenueKey });
      const prev = qc.getQueryData<RevenueEntry[]>(revenueKey);
      qc.setQueryData<RevenueEntry[]>(revenueKey, (old) => old?.map((r) => (r.id === id ? ({ ...r, ...patch } as RevenueEntry) : r)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(revenueKey, ctx?.prev); toast.error(e.message); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: revenueKey });
      qc.invalidateQueries({ queryKey: dealKeys.deals });
    },
  });
}
export function useDeleteRevenue() {
  const qc = useQueryClient();
  return (row: { id: string }, label: string) => {
    const prev = qc.getQueryData<RevenueEntry[]>(revenueKey);
    const prevDeals = qc.getQueryData<BrandDeal[]>(dealKeys.deals);
    qc.setQueryData<BrandDeal[]>(dealKeys.deals, old => old?.filter(d => d.revenue_entry_id !== row.id));
    qc.setQueryData<RevenueEntry[]>(revenueKey, (o) => o?.filter((r) => r.id !== row.id));
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      const { error } = await supabase.from('revenue_entries').delete().eq('id', row.id);
      if (error) { toast.error(error.message); qc.setQueryData(revenueKey, prev); qc.setQueryData(dealKeys.deals, prevDeals); }
      refreshAll(qc);
    }, 5000);
    toast(`Deleted “${label}”`, { duration: 5000, action: { label: 'Undo', onClick: () => { undone = true; clearTimeout(timer); qc.setQueryData(revenueKey, prev); qc.setQueryData(dealKeys.deals, prevDeals); } } });
  };
}

/* ---------- Deal tasks (checklist + reminders per brand deal) ---------- */
type DealTaskPatch = Database['public']['Tables']['deal_tasks']['Update'];
const dealTaskRetry = (count: number, error: unknown) => !isMissingTableError(error, 'deal_tasks') && count < 2;

export function useDealTasks() {
  return useQuery({
    queryKey: keys.dealTasks,
    queryFn: async () => fetchAll((from, to) => supabase.from('deal_tasks').select('*').order('sort_order').order('created_at').order('id').range(from, to)),
    retry: dealTaskRetry,
  });
}

export function useCreateDealTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['deal_tasks']['Insert']): Promise<DealTask> => unwrap(await supabase.from('deal_tasks').insert(input).select().single()),
    onSuccess: (row) => qc.setQueryData<DealTask[]>(keys.dealTasks, (old) => [...(old ?? []), row]),
    onError: (e) => toast.error(isMissingTableError(e, 'deal_tasks') ? SETUP_HINT : e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.dealTasks }),
  });
}

export function useUpdateDealTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: DealTaskPatch }) => unwrap(await supabase.from('deal_tasks').update(patch).eq('id', id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.dealTasks });
      const prev = qc.getQueryData<DealTask[]>(keys.dealTasks);
      qc.setQueryData<DealTask[]>(keys.dealTasks, (old) => old?.map((t) => (t.id === id ? ({ ...t, ...patch } as DealTask) : t)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(keys.dealTasks, ctx?.prev); toast.error(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.dealTasks }),
  });
}

export function useDeleteDealTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('deal_tasks').delete().eq('id', id); if (error) throw new Error(error.message); },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.dealTasks });
      const prev = qc.getQueryData<DealTask[]>(keys.dealTasks);
      qc.setQueryData<DealTask[]>(keys.dealTasks, (old) => old?.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(keys.dealTasks, ctx?.prev); toast.error(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.dealTasks }),
  });
}

/* ---------- Challenges ---------- */
export type { Challenge };
type ChallengePatch = Database["public"]["Tables"]["challenges"]["Update"];

/** True when the challenges table hasn't been created yet (database update not applied). */
/** True when a table hasn't been created yet (its migration isn't applied in Lovable). */
export function isMissingTableError(error: unknown, table = "challenges") {
  const message = error instanceof Error ? error.message : "";
  return message.includes(table) && /(schema cache|does not exist)/.test(message);
}

export function useChallenges() {
  return useQuery({
    queryKey: keys.challenges,
    queryFn: async () => fetchAll((from, to) => supabase.from("challenges").select("*").order("created_at").order('id').range(from, to)),
    retry: (count, error) => !isMissingTableError(error) && count < 3,
  });
}

/** Challenges for the profile picked in the sidebar ("All accounts" = everything). */
export function useScopedChallenges() {
  const q = useChallenges();
  const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["challenges"]["Insert"]): Promise<Challenge> =>
      unwrap(await supabase.from("challenges").insert(await validateCreationProfile(input)).select().single()),
    onSuccess: (row) => qc.setQueryData<Challenge[]>(keys.challenges, (old) => [...(old ?? []), row]),
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ChallengePatch }) =>
      unwrap(await supabase.from("challenges").update(patch).eq("id", id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.challenges });
      const prev = qc.getQueryData<Challenge[]>(keys.challenges);
      qc.setQueryData<Challenge[]>(keys.challenges, (old) => old?.map((c) => (c.id === id ? ({ ...c, ...patch } as Challenge) : c)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.challenges, ctx?.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.challenges }),
  });
}

/** Adds (or with a negative step, removes) manual progress in the current period. */
export function useStepChallenge() {
  const update = useUpdateChallenge();
  return (c: Challenge, step: 1 | -1) => {
    const key = periodKey(c.period, new Date());
    const current = c.progress_period === key ? c.progress : 0;
    const progress = Math.max(0, current + step);
    if (progress !== current) update.mutate({ id: c.id, patch: { progress, progress_period: key } });
  };
}

/**
 * Scoped challenges with live progress and history, worked out from all
 * content (each challenge filters to its own profile).
 */
export function useChallengeRows() {
  const challenges = useScopedChallenges();
  const content = useContent();
  const now = new Date();
  const rows = challenges.data && content.data
    ? challenges.data.map((challenge) => ({
        challenge,
        progress: challengeProgress(challenge, content.data, now),
        history: challengeHistory(challenge, content.data, now),
      }))
    : undefined;
  return {
    rows,
    isLoading: challenges.isLoading || content.isLoading,
    error: challenges.error ?? content.error,
    refetch: () => { void challenges.refetch(); void content.refetch(); },
  };
}

/* ---------- Goals, plans and projects ---------- */
export type { Goal };
type GoalPatch = Database["public"]["Tables"]["goals"]["Update"];

export function useGoals() {
  return useQuery({
    queryKey: keys.goals,
    queryFn: async () => fetchAll((from, to) => supabase.from("goals").select("*").order("created_at").order('id').range(from, to)),
  });
}

/** Goals for the profile picked in the sidebar ("All accounts" = everything). */
export function useScopedGoals() {
  const q = useGoals();
  const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["goals"]["Insert"]): Promise<Goal> =>
      unwrap(await supabase.from("goals").insert(await validateCreationProfile(input)).select().single()),
    onSuccess: (row) => qc.setQueryData<Goal[]>(keys.goals, (old) => [...(old ?? []), row]),
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: GoalPatch }) =>
      unwrap(await supabase.from("goals").update(patch).eq("id", id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.goals });
      const prev = qc.getQueryData<Goal[]>(keys.goals);
      qc.setQueryData<Goal[]>(keys.goals, (old) => old?.map((g) => (g.id === id ? ({ ...g, ...patch } as Goal) : g)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.goals, ctx?.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.goals }),
  });
}

/* ---------- Your workflow settings: Working on steps + Pipeline columns (one row per user) ---------- */

type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"];
type WorkflowSettings = { steps?: readonly WorkflowStep[]; stages?: readonly Stage[] };
const parsedWorkflows = new WeakMap<WorkflowRow, Workflow>();
const parsedStages = new WeakMap<WorkflowRow, StageList>();
const SETUP_HINT = "This needs a quick database update. In Lovable, ask it to apply the latest migration.";

export function useWorkflowRow() {
  return useQuery({
    queryKey: keys.workflow,
    queryFn: async (): Promise<WorkflowRow | null> => {
      const { data, error } = await supabase.from("workflows").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60_000,
    retry: (count, error) => !isMissingTableError(error, "workflows") && count < 2,
  });
}

/** Your workflow steps, falling back to the built-in one until you edit it (or before the table exists). */
export function useWorkflow(): { steps: Workflow; custom: boolean; editable: boolean } {
  const { data, error, isSuccess } = useWorkflowRow();
  if (!data) return { steps: WORKFLOW, custom: false, editable: isSuccess && !error };
  let steps = parsedWorkflows.get(data);
  if (!steps) parsedWorkflows.set(data, (steps = parseWorkflow(data.steps) ?? WORKFLOW));
  return { steps, custom: steps !== WORKFLOW, editable: true };
}

/** Your Pipeline columns, falling back to the built-in stages. */
export function useStages(): { stages: StageList; editable: boolean } {
  const { data, error, isSuccess } = useWorkflowRow();
  if (!data) return { stages: DEFAULT_STAGES, editable: isSuccess && !error };
  let stages = parsedStages.get(data);
  if (!stages) parsedStages.set(data, (stages = parseStages((data as { stages?: unknown }).stages) ?? DEFAULT_STAGES));
  return { stages, editable: true };
}

/** Saves steps and/or columns (an empty list restores the built-in one). Updates the screen right away. */
function useSaveWorkflowSettings() {
  const qc = useQueryClient();
  return useMutation({
    // No profile on this row, so there is nothing for validateCreationProfile to check.
    mutationFn: async (patch: WorkflowSettings) =>
      unwrap(await supabase.from("workflows").upsert(patch as unknown as { steps?: Json; stages?: Json }, { onConflict: "user_id" }).select().single()),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.workflow });
      const prev = qc.getQueryData<WorkflowRow | null>(keys.workflow);
      const now = new Date().toISOString();
      qc.setQueryData<WorkflowRow>(keys.workflow, {
        id: prev?.id ?? "pending", user_id: prev?.user_id ?? "", created_at: prev?.created_at ?? now, updated_at: now,
        steps: (patch.steps ?? prev?.steps ?? []) as unknown as Json,
        stages: (patch.stages ?? prev?.stages ?? []) as unknown as Json,
      });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.workflow, ctx?.prev ?? null);
      toast.error(isMissingTableError(e, "workflows") || /stages/.test(e.message) ? SETUP_HINT : e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.workflow }),
  });
}

export function useSaveWorkflow() {
  const m = useSaveWorkflowSettings();
  return { ...m, mutate: (steps: readonly WorkflowStep[]) => m.mutate({ steps }) };
}

export function useSaveStages() {
  const m = useSaveWorkflowSettings();
  return { ...m, mutate: (stages: readonly Stage[]) => m.mutate({ stages }) };
}

/** Moves every video in one column to another (used when a column is removed). */
export function useMoveStageVideos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { error } = await supabase.from("content_items").update({ stage: to }).eq("stage", from);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ from, to }) => {
      await qc.cancelQueries({ queryKey: keys.content });
      const prev = qc.getQueryData<ContentItem[]>(keys.content);
      qc.setQueryData<ContentItem[]>(keys.content, (old) => old?.map((c) => (c.stage === from ? { ...c, stage: to } : c)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(keys.content, ctx?.prev); toast.error(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.content }),
  });
}

/* ---------- Private files (library uploads and thumbnails) ---------- */

export const FILE_BUCKET = "library";
const FILE_LIMIT = 25 * 1024 * 1024;

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please sign in again.");
  return id;
}

/** Uploads to <user>/<folder>/<name> in the private bucket and returns the stored path. */
async function uploadPrivateFile(folder: string, file: File) {
  if (file.size > FILE_LIMIT) throw new Error("Files can be up to 25 MB.");
  const path = `${await currentUserId()}/${folder}/${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file, { upsert: false, ...(file.type ? { contentType: file.type } : {}) });
  if (error) throw new Error(/bucket/i.test(error.message) ? SETUP_HINT : error.message);
  return path;
}

async function removePrivateFiles(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(FILE_BUCKET).remove(list);
}

/** Short-lived link to a private file, cached for 45 minutes (links last an hour). */
export function useFileUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["file-url", path],
    enabled: !!path,
    staleTime: 45 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path!, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
}

/** Opens a private file in a new tab. The tab opens first so popup blockers allow it. */
export async function openPrivateFile(path: string) {
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) {
    tab?.close();
    toast.error(error?.message ?? "Couldn't open the file");
    return;
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = data.signedUrl;
  } else window.location.assign(data.signedUrl);
}

/** Video thumbnail: upload replaces the old file; null removes it. */
export function useSetThumbnail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, file }: { item: ContentItem; file: File | null }) => {
      if (file && !file.type.startsWith("image/")) throw new Error("Choose an image file.");
      const path = file ? await uploadPrivateFile(`thumbnails/${item.id}`, file) : null;
      const { error } = await supabase.from("content_items").update({ thumbnail_path: path }).eq("id", item.id);
      if (error) {
        await removePrivateFiles([path]);
        throw new Error(error.message);
      }
      await removePrivateFiles([item.thumbnail_path]);
      return path;
    },
    onSuccess: (path, { item }) => {
      qc.setQueryData<ContentItem[]>(keys.content, (old) => old?.map((c) => (c.id === item.id ? { ...c, thumbnail_path: path } : c)));
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.content }),
  });
}

/* ---------- Task checklist: rename and remove ---------- */

export function useRenameChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) =>
      unwrap(await supabase.from("content_checklist_items").update({ label }).eq("id", id).select().single()),
    onMutate: async ({ id, label }) => {
      await qc.cancelQueries({ queryKey: keys.checklist });
      const prev = qc.getQueryData<ChecklistItem[]>(keys.checklist);
      qc.setQueryData<ChecklistItem[]>(keys.checklist, (old) => old?.map((c) => (c.id === id ? { ...c, label } : c)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(keys.checklist, ctx?.prev); toast.error(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.checklist }),
  });
}

export function useRemoveChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_checklist_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.checklist });
      const prev = qc.getQueryData<ChecklistItem[]>(keys.checklist);
      qc.setQueryData<ChecklistItem[]>(keys.checklist, (old) => old?.filter((c) => c.id !== id));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(keys.checklist, ctx?.prev); toast.error(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.checklist }),
  });
}

/* ---------- Library: notes, docs, images and links, in optional projects ---------- */

export type LibraryItem = Database["public"]["Tables"]["library_items"]["Row"];
export type LibraryProject = Database["public"]["Tables"]["library_projects"]["Row"];
type LibraryItemInsert = Database["public"]["Tables"]["library_items"]["Insert"];
type LibraryProjectInsert = Database["public"]["Tables"]["library_projects"]["Insert"];
type LibraryItemPatch = Database["public"]["Tables"]["library_items"]["Update"];
type LibraryProjectPatch = Database["public"]["Tables"]["library_projects"]["Update"];
const libraryRetry = (count: number, error: unknown) => !isMissingTableError(error, "library_") && count < 2;

/**
 * Library changes show on screen first and reach the database right after.
 * - `*Changes` remember what the user just added or removed, so a refetch in the middle cannot
 *   bring a removed row back or hide a new one (see optimistic-list.ts).
 * - `rowQueue` runs saves for one row in order, and after that row's creation.
 * - `LIBRARY_WRITE` lets us refresh from the database only once the last pending change is done.
 */
const itemChanges = new PendingChanges<LibraryItem>();
const projectChanges = new PendingChanges<LibraryProject>();
const rowQueue = new RowQueue();
const LIBRARY_WRITE = ["library-write"] as const;

function refreshLibraryWhenIdle(qc: ReturnType<typeof useQueryClient>) {
  // Counts this change too while it finishes, so 1 means nothing else is still saving.
  if (qc.isMutating({ mutationKey: LIBRARY_WRITE }) > 1) return;
  void qc.invalidateQueries({ queryKey: keys.libraryItems });
  void qc.invalidateQueries({ queryKey: keys.libraryProjects });
}

const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

export function useLibraryItems() {
  return useQuery({
    queryKey: keys.libraryItems,
    queryFn: async () => {
      const rows = itemChanges.apply(await fetchAll((from, to) => supabase.from("library_items").select("*").order("updated_at", { ascending: false }).order('id').range(from, to)));
      // Items of a project that is being removed already show as "no project".
      return projectChanges.hasRemoved() ? rows.map((i) => (i.project_id && projectChanges.isRemoved(i.project_id) ? { ...i, project_id: null } : i)) : rows;
    },
    retry: libraryRetry,
  });
}

export function useLibraryProjects() {
  return useQuery({
    queryKey: keys.libraryProjects,
    queryFn: async () => projectChanges.apply(await fetchAll((from, to) => supabase.from("library_projects").select("*").order("name").order('id').range(from, to))),
    retry: libraryRetry,
  });
}

/** Library items for the profile picked in the sidebar ("All accounts" = everything). */
export function useScopedLibraryItems() {
  const q = useLibraryItems();
  const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}

export function useScopedLibraryProjects() {
  const q = useLibraryProjects();
  const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}

function useLibraryUpdate<T extends { id: string }, P extends object>(key: readonly string[], table: "library_items" | "library_projects") {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: LIBRARY_WRITE,
    mutationFn: ({ id, patch }: { id: string; patch: P }) =>
      rowQueue.run(id, async () => unwrap(await supabase.from(table).update(patch as never).eq("id", id).select().single())),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<T[]>(key);
      qc.setQueryData<T[]>(key, (old) => old?.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(key, ctx?.prev); toast.error(e.message); },
    onSettled: () => refreshLibraryWhenIdle(qc),
  });
}

export const useUpdateLibraryItem = () => useLibraryUpdate<LibraryItem, LibraryItemPatch>(keys.libraryItems, "library_items");
export const useUpdateLibraryProject = () => useLibraryUpdate<LibraryProject, LibraryProjectPatch>(keys.libraryProjects, "library_projects");

/** Moves a project, and everything inside it, to another profile (or to none). */
export function useMoveLibraryProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: LIBRARY_WRITE,
    mutationFn: async ({ id, account_id }: { id: string; account_id: string | null }) => {
      await validateCreationProfile({ account_id });
      unwrap(await supabase.from("library_projects").update({ account_id }).eq("id", id).select().single());
      const { error } = await supabase.from("library_items").update({ account_id }).eq("project_id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, account_id }) => {
      await Promise.all([qc.cancelQueries({ queryKey: keys.libraryProjects }), qc.cancelQueries({ queryKey: keys.libraryItems })]);
      const prevProjects = qc.getQueryData<LibraryProject[]>(keys.libraryProjects);
      const prevItems = qc.getQueryData<LibraryItem[]>(keys.libraryItems);
      qc.setQueryData<LibraryProject[]>(keys.libraryProjects, (old) => old?.map((p) => (p.id === id ? { ...p, account_id } : p)));
      qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => old?.map((i) => (i.project_id === id ? { ...i, account_id } : i)));
      return { prevProjects, prevItems };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.libraryProjects, ctx?.prevProjects);
      qc.setQueryData(keys.libraryItems, ctx?.prevItems);
      toast.error(e.message);
    },
    onSettled: () => refreshLibraryWhenIdle(qc),
  });
}

/** Creates a note or link, or uploads a file (image or doc). Pass `id` to see a note or link at once. */
export function useCreateLibraryItem() {
  const qc = useQueryClient();
  const addToCache = (row: LibraryItem) =>
    qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => (old?.some((r) => r.id === row.id) ? old.map((r) => (r.id === row.id ? row : r)) : [row, ...(old ?? [])]));
  return useMutation({
    mutationKey: LIBRARY_WRITE,
    mutationFn: async ({ file, ...input }: LibraryItemInsert & { file?: File }): Promise<LibraryItem> => {
      await validateCreationProfile(input);
      const id = input.id ?? crypto.randomUUID();
      return rowQueue.run(id, async () => {
        if (!file) return unwrap(await supabase.from("library_items").insert({ ...input, id }).select().single());
        const file_path = await uploadPrivateFile(`items/${id}`, file);
        const { data, error } = await supabase
          .from("library_items")
          .insert({ ...input, id, file_path, file_name: file.name, file_size: file.size, mime_type: file.type || null })
          .select()
          .single();
        if (error) {
          await removePrivateFiles([file_path]);
          throw new Error(error.message);
        }
        return data;
      });
    },
    onMutate: async ({ file, ...input }) => {
      // Files appear once uploaded; notes and links appear right now.
      if (file || !input.id) return;
      await qc.cancelQueries({ queryKey: keys.libraryItems });
      const now = new Date().toISOString();
      const row: LibraryItem = {
        id: input.id, user_id: "", account_id: input.account_id ?? null, project_id: input.project_id ?? null, kind: input.kind ?? "note",
        title: input.title ?? "Untitled", body: input.body ?? "", url: input.url ?? null, file_path: null, file_name: null, file_size: null,
        mime_type: null, pinned: input.pinned ?? false, created_at: now, updated_at: now,
      };
      itemChanges.add(row);
      addToCache(row);
    },
    onSuccess: (row) => addToCache(row),
    onError: (e, v) => {
      if (v.id) qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => old?.filter((r) => r.id !== v.id));
      toast.error(isMissingTableError(e, "library_") ? SETUP_HINT : e.message);
    },
    onSettled: (row, _e, v) => {
      const id = row?.id ?? v.id;
      if (id) itemChanges.settle(id);
      refreshLibraryWhenIdle(qc);
    },
  });
}

/** Creates a project. Pass `id` to see it at once. */
export function useCreateLibraryProject() {
  const qc = useQueryClient();
  const addToCache = (row: LibraryProject) =>
    qc.setQueryData<LibraryProject[]>(keys.libraryProjects, (old) => (old?.some((r) => r.id === row.id) ? old.map((r) => (r.id === row.id ? row : r)) : [...(old ?? []), row]));
  return useMutation({
    mutationKey: LIBRARY_WRITE,
    mutationFn: async (input: LibraryProjectInsert): Promise<LibraryProject> => {
      await validateCreationProfile(input);
      const id = input.id ?? crypto.randomUUID();
      return rowQueue.run(id, async () => unwrap(await supabase.from("library_projects").insert({ ...input, id }).select().single()));
    },
    onMutate: async (input) => {
      if (!input.id) return;
      await qc.cancelQueries({ queryKey: keys.libraryProjects });
      const now = new Date().toISOString();
      const row: LibraryProject = { id: input.id, user_id: "", account_id: input.account_id ?? null, name: input.name ?? "New project", pinned: input.pinned ?? false, created_at: now, updated_at: now };
      projectChanges.add(row);
      addToCache(row);
    },
    onSuccess: (row) => addToCache(row),
    onError: (e, v) => {
      if (v.id) qc.setQueryData<LibraryProject[]>(keys.libraryProjects, (old) => old?.filter((r) => r.id !== v.id));
      toast.error(isMissingTableError(e, "library_") ? SETUP_HINT : e.message);
    },
    onSettled: (row, _e, v) => {
      const id = row?.id ?? v.id;
      if (id) projectChanges.settle(id);
      refreshLibraryWhenIdle(qc);
    },
  });
}

/**
 * Removes an item: gone from the screen at once, deleted from the database right away.
 * Undo (5 s) puts the same row back. Its file is only deleted once the undo window has passed.
 */
export function useRemoveLibraryItem() {
  const qc = useQueryClient();
  return (item: LibraryItem) => {
    itemChanges.remove(item.id);
    qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => old?.filter((r) => r.id !== item.id));
    let undone = false;
    let failed = false;
    void (async () => {
      const { error } = await rowQueue.run(item.id, async () => supabase.from("library_items").delete().eq("id", item.id));
      itemChanges.settle(item.id);
      if (error) {
        failed = true;
        toast.error(error.message);
        qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => (old?.some((r) => r.id === item.id) ? old : [item, ...(old ?? [])]));
      }
      void qc.invalidateQueries({ queryKey: keys.libraryItems });
    })();
    const timer = setTimeout(() => { if (!undone && !failed) void removePrivateFiles([item.file_path]); }, 5000);
    toast(`Removed “${item.title}”`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          itemChanges.add(item);
          qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => (old?.some((r) => r.id === item.id) ? old : [item, ...(old ?? [])]));
          void (async () => {
            const { error } = await rowQueue.run(item.id, async () => supabase.from("library_items").insert(item));
            itemChanges.settle(item.id);
            if (error) {
              toast.error(`Couldn't restore “${item.title}”: ${error.message}`);
              qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => old?.filter((r) => r.id !== item.id));
            }
            void qc.invalidateQueries({ queryKey: keys.libraryItems });
          })();
        },
      },
    });
  };
}

/** Removes a project the same way. Its items are kept, outside any project. */
export function useRemoveLibraryProject() {
  const qc = useQueryClient();
  return (project: LibraryProject) => {
    const detached = new Set((qc.getQueryData<LibraryItem[]>(keys.libraryItems) ?? []).filter((i) => i.project_id === project.id).map((i) => i.id));
    const relink = (cache: LibraryItem[] | undefined, projectId: string | null) => cache?.map((i) => (detached.has(i.id) ? { ...i, project_id: projectId } : i));
    projectChanges.remove(project.id);
    qc.setQueryData<LibraryProject[]>(keys.libraryProjects, (old) => old?.filter((p) => p.id !== project.id));
    qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => relink(old, null));
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: keys.libraryProjects });
      void qc.invalidateQueries({ queryKey: keys.libraryItems });
    };
    void (async () => {
      const { error } = await supabase.from("library_projects").delete().eq("id", project.id);
      projectChanges.settle(project.id);
      if (error) {
        toast.error(error.message);
        qc.setQueryData<LibraryProject[]>(keys.libraryProjects, (old) => (old?.some((p) => p.id === project.id) ? old : [...(old ?? []), project]));
        qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => relink(old, project.id));
      }
      refresh();
    })();
    toast(`Removed project “${project.name}”. Its items are kept.`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          projectChanges.add(project);
          qc.setQueryData<LibraryProject[]>(keys.libraryProjects, (old) => (old?.some((p) => p.id === project.id) ? old : [...(old ?? []), project]));
          qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => relink(old, project.id));
          void (async () => {
            let failure = (await supabase.from("library_projects").insert(project)).error?.message;
            // Items went back out of the project when it was deleted; put them back in.
            for (const ids of chunks([...detached], 50)) {
              if (failure) break;
              failure = (await supabase.from("library_items").update({ project_id: project.id }).in("id", ids)).error?.message;
            }
            projectChanges.settle(project.id);
            if (failure) {
              toast.error(`Couldn't restore “${project.name}”: ${failure}`);
              qc.setQueryData<LibraryProject[]>(keys.libraryProjects, (old) => old?.filter((p) => p.id !== project.id));
              qc.setQueryData<LibraryItem[]>(keys.libraryItems, (old) => relink(old, null));
            }
            refresh();
          })();
        },
      },
    });
  };
}

/* ---------- Idea groups: folders that sort video ideas into sub-niches ---------- */

export type IdeaGroup = Database["public"]["Tables"]["idea_groups"]["Row"];
type IdeaGroupInsert = Database["public"]["Tables"]["idea_groups"]["Insert"];
type IdeaGroupPatch = Database["public"]["Tables"]["idea_groups"]["Update"];
const groupRetry = (count: number, error: unknown) => !isMissingTableError(error, "idea_groups") && count < 2;

/** Same approach as the Library: changes show at once, the database follows, and a refetch cannot undo them. */
const groupChanges = new PendingChanges<IdeaGroup>();
const groupQueue = new RowQueue();
const GROUP_WRITE = ["idea-group-write"] as const;

function refreshGroupsWhenIdle(qc: ReturnType<typeof useQueryClient>) {
  if (qc.isMutating({ mutationKey: GROUP_WRITE }) > 1) return;
  void qc.invalidateQueries({ queryKey: keys.ideaGroups });
}

export function useIdeaGroups() {
  return useQuery({
    queryKey: keys.ideaGroups,
    queryFn: async () => groupChanges.apply(await fetchAll((from, to) => supabase.from("idea_groups").select("*").order("created_at").order("id").range(from, to))),
    retry: groupRetry,
  });
}

/** Groups for the profile picked in the sidebar ("All accounts" = every group). */
export function useScopedIdeaGroups() {
  const q = useIdeaGroups();
  const accountId = useUI((s) => s.accountId);
  return { ...q, data: scopeToAccount(q.data, accountId) };
}

/** Creates a group. Pass `id` to see it at once. */
export function useCreateIdeaGroup() {
  const qc = useQueryClient();
  const addToCache = (row: IdeaGroup) =>
    qc.setQueryData<IdeaGroup[]>(keys.ideaGroups, (old) => (old?.some((r) => r.id === row.id) ? old.map((r) => (r.id === row.id ? row : r)) : [...(old ?? []), row]));
  return useMutation({
    mutationKey: GROUP_WRITE,
    mutationFn: async (input: IdeaGroupInsert): Promise<IdeaGroup> => {
      await validateCreationProfile(input);
      const id = input.id ?? crypto.randomUUID();
      return groupQueue.run(id, async () => unwrap(await supabase.from("idea_groups").insert({ ...input, id }).select().single()));
    },
    onMutate: async (input) => {
      if (!input.id) return;
      await qc.cancelQueries({ queryKey: keys.ideaGroups });
      const now = new Date().toISOString();
      const row: IdeaGroup = { id: input.id, user_id: "", account_id: input.account_id ?? null, name: input.name ?? "New group", pinned: input.pinned ?? false, created_at: now, updated_at: now };
      groupChanges.add(row);
      addToCache(row);
    },
    onSuccess: (row) => addToCache(row),
    onError: (e, v) => {
      if (v.id) qc.setQueryData<IdeaGroup[]>(keys.ideaGroups, (old) => old?.filter((r) => r.id !== v.id));
      toast.error(isMissingTableError(e, "idea_groups") ? SETUP_HINT : e.message);
    },
    onSettled: (row, _e, v) => {
      const id = row?.id ?? v.id;
      if (id) groupChanges.settle(id);
      refreshGroupsWhenIdle(qc);
    },
  });
}

/** Renames or pins a group. */
export function useUpdateIdeaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: GROUP_WRITE,
    mutationFn: ({ id, patch }: { id: string; patch: IdeaGroupPatch }) =>
      groupQueue.run(id, async () => unwrap(await supabase.from("idea_groups").update(patch).eq("id", id).select().single())),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.ideaGroups });
      const prev = qc.getQueryData<IdeaGroup[]>(keys.ideaGroups);
      qc.setQueryData<IdeaGroup[]>(keys.ideaGroups, (old) => old?.map((g) => (g.id === id ? ({ ...g, ...patch } as IdeaGroup) : g)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(keys.ideaGroups, ctx?.prev); toast.error(e.message); },
    onSettled: () => refreshGroupsWhenIdle(qc),
  });
}

/** Removes a group right away (Undo for 5 s restores it). Its ideas are kept, ungrouped. */
export function useRemoveIdeaGroup() {
  const qc = useQueryClient();
  return (group: IdeaGroup) => {
    const detached = new Set((qc.getQueryData<Idea[]>(keys.ideas) ?? []).filter((i) => i.group_id === group.id).map((i) => i.id));
    const relink = (cache: Idea[] | undefined, groupId: string | null) => cache?.map((i) => (detached.has(i.id) ? { ...i, group_id: groupId } : i));
    const putBack = () => {
      qc.setQueryData<IdeaGroup[]>(keys.ideaGroups, (old) => (old?.some((g) => g.id === group.id) ? old : [...(old ?? []), group]));
      qc.setQueryData<Idea[]>(keys.ideas, (old) => relink(old, group.id));
    };
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: keys.ideaGroups });
      void qc.invalidateQueries({ queryKey: keys.ideas });
    };
    groupChanges.remove(group.id);
    qc.setQueryData<IdeaGroup[]>(keys.ideaGroups, (old) => old?.filter((g) => g.id !== group.id));
    qc.setQueryData<Idea[]>(keys.ideas, (old) => relink(old, null));
    void (async () => {
      const { error } = await groupQueue.run(group.id, async () => supabase.from("idea_groups").delete().eq("id", group.id));
      groupChanges.settle(group.id);
      if (error) {
        toast.error(error.message);
        putBack();
      }
      refresh();
    })();
    toast(`Removed group “${group.name}”. Its ideas are kept.`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          groupChanges.add(group);
          putBack();
          void (async () => {
            let failure = (await groupQueue.run(group.id, async () => supabase.from("idea_groups").insert(group))).error?.message;
            // The ideas left the group when it was deleted; put them back in.
            for (const ids of chunks([...detached], 50)) {
              if (failure) break;
              failure = (await supabase.from("ideas").update({ group_id: group.id }).in("id", ids)).error?.message;
            }
            groupChanges.settle(group.id);
            if (failure) {
              toast.error(`Couldn't restore “${group.name}”: ${failure}`);
              qc.setQueryData<IdeaGroup[]>(keys.ideaGroups, (old) => old?.filter((g) => g.id !== group.id));
              qc.setQueryData<Idea[]>(keys.ideas, (old) => relink(old, null));
            }
            refresh();
          })();
        },
      },
    });
  };
}

/* ---------- Blank drafts ---------- */
/** Autosave waits 700 ms; give the last save time to start before checking. */
const DRAFT_SETTLE_MS = 1200;
const DRAFT_CACHE: Record<DraftTable, readonly string[]> = { content_items: keys.content, ideas: keys.ideas, brand_deals: dealKeys.deals, revenue_entries: revenueKey };
const DRAFT_CHILDREN: Partial<Record<DraftTable, { table: 'content_checklist_items' | 'deal_tasks' }>> = {
  content_items: { table: 'content_checklist_items' },
  brand_deals: { table: 'deal_tasks' },
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Removes a row made by "New" if it is still blank once its drawer has closed and every
 * save has landed. Reads the saved row (not the cache), and the delete only matches if the
 * row was not changed since, so real edits are never lost.
 */
export async function discardIfBlank(qc: ReturnType<typeof useQueryClient>, id: string, isOpenAgain: () => boolean): Promise<boolean> {
  const table = draftTable(id);
  if (!table) return false;
  await sleep(DRAFT_SETTLE_MS);
  for (let i = 0; i < 50 && qc.isMutating() > 0; i++) await sleep(200);
  if (isOpenAgain()) return false; // still a draft; checked again on the next close
  clearDraft(id);
  // All four tables share id / created_at / updated_at, which is all this needs.
  const from = () => supabase.from(table as 'ideas');
  const { data: row, error } = await from().select('*').eq('id', id).maybeSingle();
  if (error || !row || !isBlankDraft(table, row as Record<string, unknown>)) return false;
  const child = DRAFT_CHILDREN[table];
  if (child) {
    const { data: kids, error: kidsError } = child.table === 'deal_tasks' ? await supabase.from('deal_tasks').select('*').eq('deal_id', id) : await supabase.from('content_checklist_items').select('*').eq('content_item_id', id);
    if (kidsError) return false;
    const madeWithRow = Date.parse(row.created_at) + 5000;
    const touched = (k: Record<string, unknown>) => k['done'] === true || !!k['done_at'] || k['updated_at'] !== k['created_at'] || Date.parse(String(k['created_at'])) > madeWithRow;
    if ((kids ?? []).some((k) => touched(k as Record<string, unknown>))) return false;
  }
  const { error: deleteError, count } = await from().delete({ count: 'exact' }).eq('id', id).eq('updated_at', row.updated_at);
  if (deleteError || !count) return false;
  qc.setQueryData<{ id: string }[]>(DRAFT_CACHE[table], (old) => old?.filter((r) => r.id !== id));
  refreshAll(qc);
  return true;
}

const DRAWER_IDS = ['openContentId', 'openIdeaId', 'openDealId', 'openRevenueId'] as const;

/** Watches the drawers; when one closes on a blank new row, that row is quietly removed. */
export function useDraftCleanup() {
  const qc = useQueryClient();
  useEffect(() => useUI.subscribe((state, prev) => {
    for (const k of DRAWER_IDS) {
      const was = prev[k];
      if (was && was !== state[k] && draftTable(was)) void discardIfBlank(qc, was, () => useUI.getState()[k] === was);
    }
  }), [qc]);
}
