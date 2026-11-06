/** Shared look for small right-click menus. */
export const menuClass = "w-44";
export const menuItemClass = "gap-2 py-1 text-xs [&_svg]:size-3.5 [&_svg]:text-muted-foreground";
export const menuDangerClass = "gap-2 py-1 text-xs text-destructive focus:text-destructive [&_svg]:size-3.5 [&_svg]:!text-destructive";

/**
 * Runs an action once the menu has closed. The open menu keeps focus inside itself, which would
 * immediately blur (and end) an inline field the action opens.
 */
export const afterClose = (fn: () => void) => () => window.setTimeout(fn, 0);
const item = "gap-2 py-1 text-xs [&_svg]:size-3.5 [&_svg]:text-muted-foreground";
