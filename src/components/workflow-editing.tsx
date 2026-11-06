import type { ReactNode } from "react";
import { ArrowDownToLine, Clock3, Pencil, Plus, RotateCcw, Trash2, Type } from "lucide-react";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { afterClose, menuClass as menu, menuItemClass as item } from "@/lib/menu";

export { InlineEdit } from "./inline-edit";

/** What is being edited inline right now (one field at a time). */
export type EditTarget = { kind: "task-label" | "task-tip" | "task-minutes" | "step-label"; id: string } | null;


/** Right-click (or long-press) menu for a task. */
export function TaskMenu({ children, disabled, canRemove, custom, onEdit, onTip, onTime, onAdd, onRemove, onReset }: {
  children: ReactNode;
  disabled: boolean;
  canRemove: boolean;
  custom: boolean;
  onEdit: () => void;
  onTip: () => void;
  onTime: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onReset: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={disabled}>{children}</ContextMenuTrigger>
      <ContextMenuContent className={menu} onCloseAutoFocus={(e) => e.preventDefault()}>
        <ContextMenuItem className={item} onSelect={afterClose(onEdit)}><Pencil /> Edit task</ContextMenuItem>
        <ContextMenuItem className={item} onSelect={afterClose(onTip)}><Type /> Edit tip</ContextMenuItem>
        <ContextMenuItem className={item} onSelect={afterClose(onTime)}><Clock3 /> Edit time</ContextMenuItem>
        <ContextMenuItem className={item} onSelect={afterClose(onAdd)}><Plus /> Add task below</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className={cn(item, "text-destructive focus:text-destructive")} disabled={!canRemove} onSelect={onRemove}>
          <Trash2 className="!text-destructive" /> {canRemove ? "Remove task" : "Last task in step"}
        </ContextMenuItem>
        {custom && <ResetItem onReset={onReset} />}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Right-click (or long-press) menu for a step header. */
export function StepMenu({ children, disabled, canRemove, custom, onRename, onAddTask, onAddStep, onRemove, onReset }: {
  children: ReactNode;
  disabled: boolean;
  canRemove: boolean;
  custom: boolean;
  onRename: () => void;
  onAddTask: () => void;
  onAddStep: () => void;
  onRemove: () => void;
  onReset: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={disabled}>{children}</ContextMenuTrigger>
      <ContextMenuContent className={menu} onCloseAutoFocus={(e) => e.preventDefault()}>
        <ContextMenuItem className={item} onSelect={afterClose(onRename)}><Pencil /> Rename step</ContextMenuItem>
        <ContextMenuItem className={item} onSelect={afterClose(onAddTask)}><Plus /> Add task</ContextMenuItem>
        <ContextMenuItem className={item} onSelect={afterClose(onAddStep)}><ArrowDownToLine /> Add step below</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className={cn(item, "text-destructive focus:text-destructive")} disabled={!canRemove} onSelect={onRemove}>
          <Trash2 className="!text-destructive" /> Remove step
        </ContextMenuItem>
        {custom && <ResetItem onReset={onReset} />}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ResetItem({ onReset }: { onReset: () => void }) {
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuItem className={item} onSelect={onReset}><RotateCcw /> Reset to default workflow</ContextMenuItem>
    </>
  );
}
