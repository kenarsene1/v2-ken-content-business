import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), profile: vi.fn(), list: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: api.from } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { useAccounts, useCreateContent, useCreateIdea, useCreateDeal, useCreateRevenue, useCreateChallenge, useCreateGoal, useCreateLibraryItem, useCreateLibraryProject } from '@/lib/queries';
import { useUI } from '@/lib/store';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe('Creation profile safeguards', () => {
  // Lists are read page by page: any number of .order() calls, then .range().
  const paged: { order: () => unknown; range: () => unknown } = { order: () => paged, range: () => api.list() };

  beforeEach(() => {
    vi.clearAllMocks();
    useUI.setState({ accountId: 'deleted-profile' });
    api.profile.mockResolvedValue({ data: null, error: null });
    api.list.mockResolvedValue({ data: [], error: null });
    api.insert.mockImplementation((row) => ({ select: () => ({ single: async () => ({ data: { id: 'created', ...row }, error: null }) }) }));
    api.from.mockReturnValue({ insert: api.insert, select: () => ({ eq: () => ({ maybeSingle: api.profile }), order: () => paged }) });
  });

  it('clears a deleted persisted profile after the current profiles load', async () => {
    renderHook(() => useAccounts(), { wrapper });
    await waitFor(() => expect(useUI.getState().accountId).toBeNull());
  });

  it.each([
    ['content', useCreateContent], ['ideas', useCreateIdea], ['deals', useCreateDeal],
    ['money', useCreateRevenue], ['challenges', useCreateChallenge], ['goals', useCreateGoal],
    ['library items', useCreateLibraryItem], ['library projects', useCreateLibraryProject],
  ] as const)('blocks unavailable profiles before inserting %s', async (_name, hook) => {
    const { result } = renderHook(() => hook(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ account_id: 'deleted-profile' })).rejects.toThrow('This profile is no longer available');
    });
    expect(api.insert).not.toHaveBeenCalled();
    expect(useUI.getState().accountId).toBeNull();
  });

  it('preserves the selected active profile on new content', async () => {
    api.profile.mockResolvedValue({ data: { id: 'active-profile', archived_at: null }, error: null });
    useUI.setState({ accountId: 'active-profile' });
    const { result } = renderHook(() => useCreateContent(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ title: 'My next video', account_id: 'active-profile' }); });
    expect(api.insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'My next video', account_id: 'active-profile' }));
    expect(useUI.getState().accountId).toBe('active-profile');
  });

  it('creates unassigned content in All accounts without a profile lookup', async () => {
    useUI.setState({ accountId: null });
    const { result } = renderHook(() => useCreateContent(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ account_id: null }); });
    expect(api.profile).not.toHaveBeenCalled();
    expect(api.insert).toHaveBeenCalledWith(expect.objectContaining({ account_id: null }));
  });

  it('does not move an explicitly archived profile to another profile', async () => {
    api.profile.mockResolvedValue({ data: { id: 'archived', archived_at: '2026-10-27' }, error: null });
    const { result } = renderHook(() => useCreateContent(), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ account_id: 'archived' })).rejects.toThrow('This profile is no longer available'); });
    expect(api.insert).not.toHaveBeenCalled();
  });
});