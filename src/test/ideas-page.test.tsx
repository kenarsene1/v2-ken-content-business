import type React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Idea, IdeaGroup } from '@/lib/queries';

const api = vi.hoisted(() => ({
  ideas: [] as unknown[], groups: [] as unknown[],
  create: vi.fn(), update: vi.fn(), promote: vi.fn(), createGroup: vi.fn(), updateGroup: vi.fn(), removeGroup: vi.fn(),
}));
vi.mock('@/lib/queries', () => ({
  useScopedIdeas: () => ({ data: api.ideas, isLoading: false, error: null, refetch: vi.fn() }),
  useScopedIdeaGroups: () => ({ data: api.groups }),
  useAccounts: () => ({ data: [] }),
  useActiveAccounts: () => ({ data: [] }),
  useCreateIdea: () => ({ mutateAsync: api.create, isPending: false }),
  useCreateIdeaGroup: () => ({ mutate: api.createGroup }),
  useUpdateIdeaGroup: () => ({ mutate: api.updateGroup }),
  useRemoveIdeaGroup: () => api.removeGroup,
  useUpdateIdea: () => ({ mutate: api.update }),
  usePromoteIdea: () => ({ mutate: api.promote, isPending: false }),
}));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (opts: unknown) => opts }));

import { Route } from '@/routes/_authenticated/ideas';
import { useUI } from '@/lib/store';

const IdeasPage = (Route as unknown as { component: () => React.ReactElement }).component;
const idea = (patch: Partial<Idea>): Idea => ({
  id: 'i1', user_id: 'u', account_id: null, group_id: null, title: 'Build an app with Lovable', note: 'Hook: 10 minutes', status: 'new', source: 'own_thought',
  tags: ['ai'], reach: 4, ease: 3, relevance: 5, content_item_id: null, created_at: '2026-10-20T09:00:00Z', updated_at: '2026-10-20T09:00:00Z', ...patch,
} as Idea);
const group = (patch: Partial<IdeaGroup>): IdeaGroup => ({
  id: 'g1', user_id: 'u', account_id: null, name: 'AI agents', pinned: false, created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', ...patch,
});

describe('Ideas page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUI.setState({ ideasView: 'cards', accountId: null });
    api.groups = [];
    api.ideas = [idea({}), idea({ id: 'i2', title: 'Old shelved idea', status: 'archived' })];
  });

  it('shows ideas as cards with compact controls and hides archived ones', () => {
    render(<IdeasPage />);
    expect(screen.getByText('Build an app with Lovable')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.queryByText('Old shelved idea')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist Build an app with Lovable' }));
    expect(api.update).toHaveBeenCalledWith({ id: 'i1', patch: { status: 'shortlisted' } });
  });

  it('switches to a table view and remembers it', () => {
    render(<IdeasPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(useUI.getState().ideasView).toBe('table');
    const table = screen.getByRole('table');
    expect(within(table).getByText('Build an app with Lovable')).toBeInTheDocument();
    expect(within(table).getByText('My own thought')).toBeInTheDocument();
    expect(within(table).getByText('Fresh')).toBeInTheDocument();
  });

  it('captures an idea on Enter', () => {
    api.create.mockResolvedValue({});
    render(<IdeasPage />);
    const input = screen.getByRole('textbox', { name: 'New idea title' });
    fireEvent.change(input, { target: { value: '  New spark ' } });
    fireEvent.submit(input.closest('form')!);
    expect(api.create).toHaveBeenCalledWith({ title: 'New spark', account_id: null });
  });

  describe('groups', () => {
    beforeEach(() => {
      api.groups = [group({})];
      api.ideas = [idea({}), idea({ id: 'i3', title: 'Agent that books flights', group_id: 'g1' })];
    });

    it('puts groups first, with loose ideas below and grouped ideas inside the group', () => {
      render(<IdeasPage />);
      const groups = screen.getByLabelText('Groups');
      expect(within(groups).getByText('AI agents')).toBeInTheDocument();
      expect(within(groups).getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Build an app with Lovable')).toBeInTheDocument();
      expect(screen.queryByText('Agent that books flights')).not.toBeInTheDocument();
      // Groups come before the ideas on the page.
      expect(groups.compareDocumentPosition(screen.getByText('Build an app with Lovable')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      fireEvent.click(within(groups).getByRole('button', { name: 'AI agents' }));
      expect(screen.getByText('Agent that books flights')).toBeInTheDocument();
      expect(screen.queryByText('Build an app with Lovable')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Groups')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Video ideas' }));
      expect(screen.getByText('Build an app with Lovable')).toBeInTheDocument();
    });

    it('captures new ideas into the open group', () => {
      api.create.mockResolvedValue({});
      render(<IdeasPage />);
      fireEvent.click(within(screen.getByLabelText('Groups')).getByRole('button', { name: 'AI agents' }));
      const input = screen.getByRole('textbox', { name: 'New idea title' });
      fireEvent.change(input, { target: { value: 'Agent swarm' } });
      fireEvent.submit(input.closest('form')!);
      expect(api.create).toHaveBeenCalledWith({ title: 'Agent swarm', account_id: null, group_id: 'g1' });
    });

    it('lists everything flat while searching', () => {
      render(<IdeasPage />);
      fireEvent.change(screen.getByRole('textbox', { name: 'Search ideas' }), { target: { value: 'agent' } });
      expect(screen.getByText('Agent that books flights')).toBeInTheDocument();
      expect(screen.queryByLabelText('Groups')).not.toBeInTheDocument();
    });

    it('adds a group from a right-click on the workspace', async () => {
      const { container } = render(<IdeasPage />);
      fireEvent.contextMenu(container.querySelector('.canvas-dots')!);
      fireEvent.click(await screen.findByRole('menuitem', { name: /New group/ }));
      const input = await screen.findByRole('textbox', { name: /Group name/ });
      fireEvent.change(input, { target: { value: '  No   code ' } });
      fireEvent.submit(input.closest('form')!);
      expect(api.createGroup).toHaveBeenCalledWith({ id: expect.any(String), name: 'No code', account_id: null });
    });

    it('edits a group from a right-click on it: rename, pin and remove', async () => {
      render(<IdeasPage />);
      const tile = () => within(screen.getByLabelText('Groups')).getByRole('button', { name: 'AI agents' }).parentElement!;

      fireEvent.contextMenu(tile());
      fireEvent.click(await screen.findByRole('menuitem', { name: /Pin to front/ }));
      expect(api.updateGroup).toHaveBeenCalledWith({ id: 'g1', patch: { pinned: true } });

      fireEvent.contextMenu(tile());
      fireEvent.click(await screen.findByRole('menuitem', { name: /Rename/ }));
      const edit = await screen.findByRole('textbox', { name: 'Group name' });
      fireEvent.change(edit, { target: { value: 'Agents & automation' } });
      fireEvent.keyDown(edit, { key: 'Enter' });
      await waitFor(() => expect(api.updateGroup).toHaveBeenCalledWith({ id: 'g1', patch: { name: 'Agents & automation' } }));

      fireEvent.contextMenu(tile());
      fireEvent.click(await screen.findByRole('menuitem', { name: /Remove group/ }));
      expect(api.removeGroup).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1' }));
    });

    it('moves an idea into a group from a right-click on it, and only the right-click on the idea opens its menu', async () => {
      render(<IdeasPage />);
      fireEvent.contextMenu(screen.getByText('Build an app with Lovable').closest('article')!);
      expect(await screen.findByRole('menuitem', { name: /Open & edit/ })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /New group/ })).not.toBeInTheDocument();
      const sub = screen.getByRole('menuitem', { name: /Move to group/ });
      sub.focus();
      fireEvent.keyDown(sub, { key: 'ArrowRight' });
      fireEvent.click(await screen.findByRole('menuitem', { name: /AI agents/ }));
      expect(api.update).toHaveBeenCalledWith({ id: 'i1', patch: { group_id: 'g1' } });
    });
  });
});
