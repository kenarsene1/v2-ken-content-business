import { useNavigate } from "@tanstack/react-router";
import { Library as LibraryIcon, CalendarDays, Columns3, FileText, Handshake, Kanban, LayoutDashboard, Lightbulb, Moon, Plus, Target, Trophy, UserPlus, Users, Wallet } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import { useActiveAccounts as useAccounts, useScopedContent, useScopedIdeas, useCreateIdea, useCreateChallenge, useCreateGoal, useStages } from "@/lib/queries";
import { GOAL_DEFAULTS } from "@/lib/goals";
import { challengeFromTemplate, DEFAULT_CHALLENGE } from "@/lib/challenges";
import { ProfileAvatar } from './profile-avatar';
import { useUI } from "@/lib/store";
import { stageLabel } from "@/lib/stages";
import { PlatformDot } from "./bits";
import { markDraft } from "@/lib/drafts";
import { useNewContent } from "./app-shell";

export function CommandPalette({ onNew }: { onNew: () => void }) {
  const { paletteOpen, setPaletteOpen, openContent, openAccount, setAccountId, theme, setTheme } = useUI();
  const navigate = useNavigate();
  const { stages } = useStages();
  const { data: content } = useScopedContent();
  const { data: accounts } = useAccounts();
  const newContent = useNewContent();
  const { data: ideas } = useScopedIdeas();
  const createIdea = useCreateIdea();
  const createChallenge = useCreateChallenge();
  const createGoal = useCreateGoal();
  const run = (fn: () => void) => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => run(async () => { const row = await createIdea.mutateAsync({ account_id: useUI.getState().accountId }); markDraft('ideas', row.id); useUI.getState().openIdea(row.id); })}><Lightbulb className="mr-2 h-4 w-4" />New idea</CommandItem>
          <CommandItem onSelect={() => run(async () => { navigate({ to: "/goals", search: { view: "challenges" } }); const row = await createChallenge.mutateAsync(challengeFromTemplate(DEFAULT_CHALLENGE, useUI.getState().accountId)); useUI.getState().openChallenge(row.id); })}><Trophy className="mr-2 h-4 w-4" />New challenge</CommandItem>
          <CommandItem onSelect={() => run(async () => { navigate({ to: "/goals" }); const row = await createGoal.mutateAsync({ ...GOAL_DEFAULTS.goal, account_id: useUI.getState().accountId }); useUI.getState().openGoal(row.id); })}><Target className="mr-2 h-4 w-4" />New goal</CommandItem>
          <CommandItem onSelect={() => run(() => newContent())}>
            <Plus className="mr-2 h-4 w-4" /> New content item <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(async () => {
                navigate({ to: "/settings/profiles" });
                useUI.getState().setAddProfile({});
              })
            }
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add profile
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => navigate({ to: '/ideas' }))}><Lightbulb className="mr-2 h-4 w-4" />Video ideas<CommandShortcut>G I</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: '/deals' }))}><Handshake className="mr-2 h-4 w-4" />Brand deals<CommandShortcut>G B</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: '/revenue' }))}><Wallet className="mr-2 h-4 w-4" />Revenue<CommandShortcut>G R</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: '/goals', search: { view: 'challenges' } }))}><Trophy className="mr-2 h-4 w-4" />Challenges<CommandShortcut>G H</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: '/goals' }))}><Target className="mr-2 h-4 w-4" />Goals & plans<CommandShortcut>G O</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/library" }))}><LibraryIcon className="mr-2 h-4 w-4" />Library</CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/dashboard" }))}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/pipeline" }))}>
            <Kanban className="mr-2 h-4 w-4" /> Working on <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/pipeline/board" }))}>
            <Columns3 className="mr-2 h-4 w-4" /> Pipeline board
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/calendar" }))}>
            <CalendarDays className="mr-2 h-4 w-4" /> Calendar <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/settings/profiles" }))}>
            <Users className="mr-2 h-4 w-4" /> Settings · Profiles <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme(theme === "dark" ? "light" : "dark"))}>
            <Moon className="mr-2 h-4 w-4" /> Toggle dark mode
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Switch account">
          <CommandItem onSelect={() => run(() => setAccountId(null))}>All accounts</CommandItem>
          {accounts?.map((a) => (
            <CommandItem key={a.id} value={`switch ${a.name} ${a.handle ?? ""}`} onSelect={() => run(() => setAccountId(a.id))}>
              <ProfileAvatar account={a} className="mr-2 h-5 w-5" /> {a.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Content">
          {content?.map((c) => (
            <CommandItem key={c.id} value={`${c.title} ${c.id}`} onSelect={() => run(() => openContent(c.id))}>
              <FileText className="mr-2 h-4 w-4" />
              <span className="truncate">{c.title}</span>
              <CommandShortcut>{stageLabel(c.stage, stages)}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Video ideas">{ideas?.map((i) => <CommandItem key={i.id} value={`idea ${i.title} ${i.id}`} onSelect={() => run(() => useUI.getState().openIdea(i.id))}><Lightbulb className="mr-2 h-4 w-4" /><span className="truncate">{i.title}</span></CommandItem>)}</CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
