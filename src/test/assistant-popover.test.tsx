import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ content: [] as unknown[], deals: [] as unknown[], loading: false }));
vi.mock('@/lib/queries', () => ({
  useContent: () => ({ data: api.content, isLoading: api.loading, isError: false }),
  useDeals: () => ({ data: api.deals, isLoading: api.loading, isError: false }),
  useAccounts: () => ({ data: [{ id: 'p1', name: 'Vibe Coding' }] }),
}));
vi.mock('@/components/assistant-panel', () => ({ AssistantAsk: () => <p>Chat view</p> }));

import { AssistantPopover } from '@/components/assistant-popover';
import { hasPlatformIcon, PlatformIcon } from '@/components/platform-icon';
import { ASSISTANT_POP_DELAY, resetAssistantPopup, useAssistantPopup } from '@/components/use-assistant-popup';
import { reminderWhen } from '@/lib/reminders';
import { useUI } from '@/lib/store';

const today = new Date();
const iso = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
const item = (id: string, due: string | null, extra: Record<string, unknown> = {}) => ({ id, title: `Video ${id}`, stage: 'idea', due_date: due, publish_at: null, priority: 'medium', account_id: 'p1', ...extra });

describe('Platform icons', () => {
  it('has a brand mark for the six main platforms only', () => {
    for (const id of ['youtube', 'instagram', 'tiktok', 'facebook', 'threads', 'x']) expect(hasPlatformIcon(id)).toBe(true);
    expect(hasPlatformIcon('linkedin')).toBe(false);
    expect(hasPlatformIcon('nope')).toBe(false);
  });

  it('draws the mark in the platform colour, and nothing for others', () => {
    const { container, rerender } = render(<PlatformIcon platform="tiktok" />);
    expect(screen.getByRole('img', { name: 'TikTok' })).toHaveStyle({ color: 'var(--platform-tiktok)' });
    rerender(<PlatformIcon platform="linkedin" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('reminderWhen', () => {
  it('keeps the date short', () => {
    expect(reminderWhen({ date: iso(-2), overdue: true })).toBe('Overdue');
    expect(reminderWhen({ date: iso(0), overdue: false })).toBe('Today');
    expect(reminderWhen({ date: iso(1), overdue: false })).toBe('Tomorrow');
    expect(reminderWhen({ date: iso(3), overdue: false })).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    expect(reminderWhen({ date: iso(9), overdue: false })).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    expect(reminderWhen({ date: null, overdue: false })).toBe('No date');
  });
});

describe('Assistant pop-up timing', () => {
  beforeEach(() => { vi.useFakeTimers(); resetAssistantPopup(); });
  afterEach(() => vi.useRealTimers());
  const mount = (path: string) => renderHook(({ at }) => useAssistantPopup(at), { initialProps: { at: path } });

  it('slides in on the dashboard once per page load; once closed it stays closed', () => {
    const { result, rerender } = mount('/dashboard');
    expect(result.current.open).toBe(false);
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY));
    expect(result.current).toMatchObject({ open: true, mounted: true });

    act(() => result.current.hide());
    rerender({ at: '/ideas' });
    rerender({ at: '/dashboard' });
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY * 4));
    expect(result.current.open).toBe(false);
  });

  it('does not come back after leaving the dashboard, even without closing it', () => {
    const { result, rerender } = mount('/dashboard');
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY));
    rerender({ at: '/calendar' });
    expect(result.current.open).toBe(false);
    rerender({ at: '/dashboard' });
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY * 4));
    expect(result.current.open).toBe(false);
  });

  it('pops again after a refresh', () => {
    const first = mount('/dashboard');
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY));
    first.unmount();
    resetAssistantPopup(); // a page refresh starts a new load
    const { result } = mount('/dashboard');
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY));
    expect(result.current.open).toBe(true);
  });

  it('never pops by itself on other pages, and the header button still opens it', () => {
    const { result, rerender } = mount('/pipeline');
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY * 4));
    expect(result.current).toMatchObject({ open: false, mounted: false });
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    rerender({ at: '/deals' });
    expect(result.current.open).toBe(false);
  });

  it('waits until you actually reach the dashboard on a load that starts elsewhere', () => {
    const { result, rerender } = mount('/ideas');
    rerender({ at: '/dashboard' });
    act(() => vi.advanceTimersByTime(ASSISTANT_POP_DELAY));
    expect(result.current.open).toBe(true);
  });
});

describe('Assistant pop-up', () => {
  beforeEach(() => {
    api.loading = false;
    api.deals = [];
    api.content = [item('a', iso(-1)), item('b', iso(0)), item('c', iso(1)), item('d', iso(2)), item('e', iso(3)), item('f', iso(4))];
    useUI.setState({ openContentId: null });
  });

  it('shows a short list with the count, overdue first, and expands on demand', async () => {
    render(<AssistantPopover open onMinimize={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Assistant' })).toHaveAttribute('data-state', 'open'));
    expect(screen.getByRole('button', { name: /Today\s*6/ })).toHaveAttribute('aria-pressed', 'true');
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Video a');
    expect(rows[0]).toHaveTextContent('Overdue');
    expect(rows[0]).toHaveTextContent('Content deadline · Vibe Coding');

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('opens the item, and hides with the minus button or Escape', () => {
    const onMinimize = vi.fn();
    render(<AssistantPopover open onMinimize={onMinimize} />);
    fireEvent.click(screen.getByRole('button', { name: /Video b/ }));
    expect(useUI.getState().openContentId).toBe('b');

    fireEvent.click(screen.getByRole('button', { name: 'Hide assistant' }));
    fireEvent.keyDown(screen.getByRole('button', { name: /Video c/ }), { key: 'Escape' });
    expect(onMinimize).toHaveBeenCalledTimes(2);
  });

  it('says all clear when nothing is due, and loads the chat only when Ask is chosen', async () => {
    api.content = [];
    render(<AssistantPopover open onMinimize={vi.fn()} />);
    expect(screen.getByText('All clear. Nothing due this week.')).toBeInTheDocument();
    expect(screen.queryByText('Chat view')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Chat view')).toBeInTheDocument();
  });

  it('is not a modal, so page shortcuts keep working under it', () => {
    render(<AssistantPopover open onMinimize={vi.fn()} />);
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
