import { useEffect, useState } from "react";

/** Delay before the assistant slides in on the dashboard, so the page settles first. */
export const ASSISTANT_POP_DELAY = 450;

/** Lives for the whole page load, so the pop happens once until the page is refreshed. */
let poppedThisLoad = false;

/** Test helper: behave as if the page was just loaded. */
export function resetAssistantPopup() {
  poppedThisLoad = false;
}

/**
 * Assistant pop-up state.
 * - Slides in by itself only on the dashboard, and only once per page load.
 * - Once closed it stays closed until a refresh, even when you come back to the dashboard.
 * - Hides whenever you go to another page. The header button still opens it on demand.
 */
export function useAssistantPopup(path: string) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const onDashboard = path === "/dashboard";

  useEffect(() => {
    if (!onDashboard || poppedThisLoad) return;
    const timer = setTimeout(() => {
      poppedThisLoad = true;
      setMounted(true);
      setOpen(true);
    }, ASSISTANT_POP_DELAY);
    return () => clearTimeout(timer);
  }, [onDashboard]);

  // Any page change hides it.
  useEffect(() => { setOpen(false); }, [path]);

  return {
    open,
    mounted,
    toggle: () => { setMounted(true); setOpen((wasOpen) => !wasOpen); },
    hide: () => setOpen(false),
  };
}
