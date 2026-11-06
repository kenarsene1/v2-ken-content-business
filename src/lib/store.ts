import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface UIState {
  accountId: string | null; // null = all accounts
  theme: Theme;
  pipelineView: "board" | "table";
  ideasView: "cards" | "table";
  setIdeasView: (v: "cards" | "table") => void;
  calendarView: "month" | "week" | "agenda";
  calendarDate: string | null;
  setCalendarView: (v: "month" | "week" | "agenda") => void;
  setCalendarDate: (v: string | null) => void;
  paletteOpen: boolean;
  openContentId: string | null;
  openAccountId: string | null;
  openIdeaId: string | null;
  openDealId: string | null;
  openDeal: (id: string | null) => void;
  openRevenueId: string | null;
  openRevenue: (id: string | null) => void;
  openIdea: (id: string | null) => void;
  openChallengeId: string | null;
  /** The video shown in the Working on focus workspace. */
  focusId: string | null;
  setFocusId: (id: string | null) => void;
  openGoalId: string | null;
  openLibraryItemId: string | null;
  openLibraryItem: (id: string | null) => void;
  openGoal: (id: string | null) => void;
  openChallenge: (id: string | null) => void;
  /** Open state of the Add profile dialog; platform pre-selects a group. */
  addProfile: { platform?: string } | null;
  setAddProfile: (v: { platform?: string } | null) => void;
  setAccountId: (id: string | null) => void;
  setTheme: (t: Theme) => void;
  setPipelineView: (v: "board" | "table") => void;
  setPaletteOpen: (o: boolean) => void;
  openContent: (id: string | null) => void;
  openAccount: (id: string | null) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      accountId: null,
      theme: "system",
      pipelineView: "board",
      ideasView: "cards",
      setIdeasView: (ideasView) => set({ ideasView }),
      calendarView: "month",
      calendarDate: null,
      setCalendarView: (calendarView) => set({ calendarView }),
      setCalendarDate: (calendarDate) => set({ calendarDate }),
      paletteOpen: false,
      openContentId: null,
      openAccountId: null,
      openIdeaId: null,
      openDealId: null,
      openDeal: (openDealId) => set({ openDealId }),
      openRevenueId: null,
      openRevenue: (openRevenueId) => set({ openRevenueId }),
      openIdea: (openIdeaId) => set({ openIdeaId }),
      openChallengeId: null,
      focusId: null,
      setFocusId: (focusId) => set({ focusId }),
      openGoalId: null,
      openLibraryItemId: null,
      openLibraryItem: (openLibraryItemId) => set({ openLibraryItemId }),
      openGoal: (openGoalId) => set({ openGoalId }),
      openChallenge: (openChallengeId) => set({ openChallengeId }),
      addProfile: null,
      setAddProfile: (addProfile) => set({ addProfile }),
      setAccountId: (accountId) => set({ accountId }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setPipelineView: (pipelineView) => set({ pipelineView }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      openContent: (openContentId) => set({ openContentId }),
      openAccount: (openAccountId) => set({ openAccountId }),
    }),
    {
      name: "creatoros-ui",
      partialize: (s) => ({ accountId: s.accountId, theme: s.theme, pipelineView: s.pipelineView, ideasView: s.ideasView, calendarView: s.calendarView, focusId: s.focusId }),
    },
  ),
);

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
