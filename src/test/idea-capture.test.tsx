import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), single: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: api.from, rpc: api.rpc } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { useCreateIdea, usePromoteIdea } from '@/lib/queries';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe('Explicit idea promotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.from.mockReturnValue({ insert: api.insert, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'profile-1', archived_at: null }, error: null }) }) }) });
    api.insert.mockReturnValue({ select: () => ({ single: api.single }) });
    api.single.mockResolvedValue({ data: { id: 'idea-1', title: 'Real idea', account_id: 'profile-1', content_item_id: null }, error: null });
    api.rpc.mockResolvedValue({ data: 'content-1', error: null });
  });
  it('captures only an idea, without creating pipeline content', async () => {
    const { result } = renderHook(() => useCreateIdea(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ title: 'Real idea', account_id: 'profile-1' }); });
    expect(api.from.mock.calls).toEqual([['ideas'], ['accounts']]);
    expect(api.insert).toHaveBeenCalledWith({ title: 'Real idea', account_id: 'profile-1' });
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it('creates linked content only through explicit promotion', async () => {
    const { result } = renderHook(() => usePromoteIdea(), { wrapper });
    let id;
    await act(async () => { id = await result.current.mutateAsync('idea-1'); });
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith('promote_idea', { _idea_id: 'idea-1' });
    expect(id).toBe('content-1');
    expect(api.from).not.toHaveBeenCalled();
  });
});