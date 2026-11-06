import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ArrowRightToLine, CalendarClock, CheckSquare, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  closestCorners, defaultDropAnimationSideEffects, DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin,
  TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DropAnimation,
} from "@dnd-kit/core";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { useContent, useMoveStageVideos, useSaveStages, useStages, useUpdateContent, type ContentItem } from "@/lib/queries";
import { addStage, columnFor, isCoreStage, removeStage, renameStage, type Stage } from "@/lib/stages";
import { stageIndex } from "@/lib/runs";
import { FORMATS, PRIORITIES, labelOf } from "@/lib/constants";
import { useUI } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "./bits";
import { Burst } from "./burst";
import { InlineEdit } from "./inline-edit";
import { afterClose, menuClass, menuDangerClass, menuItemClass } from "@/lib/menu";
import { RefLink } from "./ref-link";
import { SponsoredTag } from "./sponsored-tag";
import { useNewContent } from "./app-shell";

export type Progress = Record<string, { done: number; total: number }>;

/** Drop on the column under the pointer; fall back to the nearest one when the pointer is between columns. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

const dropAnimation: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(.2,.8,.2,1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.35" } } }),
};

/**
 * Height that ends at the bottom of the screen, so the board's sideways scrollbar is always
 * visible at the bottom instead of below the tallest column.
 */
function useFillToBottom(bottomGap: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const update = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setHeight(Math.max(360, Math.round(window.innerHeight - top - bottomGap)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [bottomGap]);
  return { ref, height };
}

export function Board({ items, progress }: { items: ContentItem[]; progress: Progress }) {
  const update = useUpdateContent();
  const { stages, editable } = useStages();
  const isMobile = useIsMobile();
  const { ref, height } = useFillToBottom(isMobile ? 96 : 20);
  const [active, setActive] = useState<ContentItem | null>(null);
  const [landed, setLanded] = useState<{ id: string; n: number; forward: boolean } | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const stage = e.over?.id as string | undefined;
    const item = items.find((i) => i.id === e.active.id);
    if (!stage || !item || columnFor(item.stage, stages) === stage) return;
    const forward = stageIndex(stage, stages) > stageIndex(item.stage, stages);
    update.mutate({ id: item.id, patch: { stage, position: Date.now() } });
    setLanded((l) => ({ id: item.id, n: (l?.n ?? 0) + 1, forward }));
    if (forward) {
      const label = stages.find((s) => s.id === stage)?.label ?? stage;
      if (stage === "published") toast.success(`Published: ${item.title}`, { description: "Another one out in the world. Nice work." });
      else toast.success(`Moved to ${label}`, { description: "One step closer to publishing." });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => setActive(items.find((i) => i.id === e.active.id) ?? null)}
      onDragEnd={onEnd}
      onDragCancel={() => setActive(null)}
    >
      <div
        ref={ref}
        style={height ? { height } : undefined}
        tabIndex={0}
        role="region"
        aria-label="Pipeline stages"
        className="pipeline-scroll -mx-4 flex gap-3 overflow-x-auto overflow-y-hidden px-4 pb-2 focus-visible:outline-2 focus-visible:outline-ring md:-mx-8 md:px-8"
      >
        {stages.map((s) => (
          <Column
            key={s.id}
            stage={s}
            items={items.filter((i) => columnFor(i.stage, stages) === s.id)}
            progress={progress}
            editable={editable}
            dragging={!!active}
            landed={landed}
          />
        ))}
      </div>
      {/* Rendered at the page root: the page's entrance animation would otherwise offset it from the cursor. */}
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {active && <CardBody item={active} progress={progress[active.id]} overlay />}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

function Column({ stage, items, progress, editable, dragging, landed }: {
  stage: Stage;
  items: ContentItem[];
  progress: Progress;
  editable: boolean;
  dragging: boolean;
  landed: { id: string; n: number; forward: boolean } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const newContent = useNewContent();
  const { stages } = useStages();
  const saveStages = useSaveStages();
  const moveVideos = useMoveStageVideos();
  const { data: all } = useContent();
  const [renaming, setRenaming] = useState(false);

  const addAfter = () => {
    const added = addStage(stages, stage.id);
    if (!added.id) return void toast("That's the most columns the board can have");
    saveStages.mutate(added.stages);
  };
  const remove = () => {
    const { stages: next, moveTo } = removeStage(stages, stage.id);
    if (!moveTo) return;
    const count = (all ?? []).filter((c) => c.stage === stage.id).length;
    if (count) moveVideos.mutate({ from: stage.id, to: moveTo });
    saveStages.mutate(next);
    const target = stages.find((s) => s.id === moveTo)?.label ?? moveTo;
    toast(`Removed “${stage.label}”`, { description: count ? `${count} video${count === 1 ? "" : "s"} moved to ${target}.` : undefined });
  };

  const header = (
    <div className="mb-2 flex h-7 items-center gap-2 px-1">
      {renaming ? (
        <InlineEdit
          label="Column name"
          value={stage.label}
          className="h-6 flex-1 text-sm font-medium"
          onSave={(label) => saveStages.mutate(renameStage(stages, stage.id, label))}
          onDone={() => setRenaming(false)}
        />
      ) : (
        <span className={cn("truncate text-sm font-medium transition-colors", isOver && "text-primary")}>{stage.label}</span>
      )}
      <span key={items.length} className="challenge-pop text-xs tabular-nums text-muted-foreground">{items.length}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void newContent("Untitled", stage.id)}
        className="ml-auto h-7 w-7 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title={`New in ${stage.label}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!editable}>{header}</ContextMenuTrigger>
        <ContextMenuContent className={menuClass} onCloseAutoFocus={(e) => e.preventDefault()}>
          <ContextMenuItem className={menuItemClass} onSelect={afterClose(() => setRenaming(true))}><Pencil /> Rename column</ContextMenuItem>
          <ContextMenuItem className={menuItemClass} disabled={stage.id === "scheduled" || stage.id === "published"} onSelect={addAfter}>
            <ArrowRightToLine /> Add column after
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className={menuDangerClass} disabled={isCoreStage(stage.id)} onSelect={remove}>
            <Trash2 /> {isCoreStage(stage.id) ? "Built-in column" : "Remove column"}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div
        ref={setNodeRef}
        className={cn(
          "pipeline-scroll min-h-40 flex-1 space-y-2.5 overflow-y-auto rounded-lg p-2 transition-[background-color,box-shadow] duration-200",
          isOver ? "bg-primary/5 ring-2 ring-inset ring-primary/40" : dragging ? "bg-muted/60" : "bg-muted/40",
        )}
      >
        {items.map((i) => (
          <DraggableCard key={i.id} item={i} progress={progress[i.id]} landed={landed?.id === i.id ? landed : null} />
        ))}
        {items.length === 0 && (
          <p className={cn("rounded-md border border-dashed px-2 py-6 text-center text-xs text-muted-foreground transition-colors", isOver && "border-primary/50 text-primary")}>
            {isOver ? `Drop to move to ${stage.label}` : "Drop cards here"}
          </p>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ item, progress, landed }: {
  item: ContentItem;
  progress: { done: number; total: number } | undefined;
  landed: { n: number; forward: boolean } | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("relative rounded-lg transition-opacity", isDragging && "opacity-35 outline-dashed outline-2 outline-primary/30")}
    >
      <CardBody key={landed ? `l-${landed.n}` : "card"} item={item} progress={progress} landed={!!landed} />
      {landed?.forward && <Burst key={landed.n} count={12} spread={34} />}
    </div>
  );
}

function CardBody({ item, progress, overlay, landed }: {
  item: ContentItem;
  progress: { done: number; total: number } | undefined;
  overlay?: boolean;
  landed?: boolean;
}) {
  const openContent = useUI((s) => s.openContent);
  const due = item.due_date ? parseISO(item.due_date) : null;
  const overdue = due && isPast(due) && !isToday(due) && item.stage !== "published";
  return (
    <div
      className={cn(
        "group relative block w-full rounded-lg border bg-card p-3 text-left transition-[border-color,box-shadow] hover:border-primary/40",
        overlay ? "drag-lift cursor-grabbing shadow-xl ring-1 ring-primary/30" : "cursor-grab",
        landed && "card-land",
      )}
    >
      <div className="flex items-start gap-2">
        {(item.priority === "urgent" || item.priority === "high") && (
          <span
            className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", item.priority === "urgent" ? "bg-priority-urgent" : "bg-priority-high")}
            title={labelOf(PRIORITIES, item.priority)}
          />
        )}
        <button
          type="button"
          onClick={() => openContent(item.id)}
          className="min-w-0 text-left text-[13px] font-medium leading-snug after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {item.title}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <SponsoredTag videoId={item.id} />
        <RefLink url={item.ref_url} />
        {item.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{labelOf(FORMATS, item.format)}</span>
        {item.parent_id && <Link2 className="h-3 w-3 text-muted-foreground" />}
      </div>
      {(due || progress) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {due && (
            <span className={cn("flex items-center gap-1", overdue && "text-destructive")}>
              <CalendarClock className="h-3 w-3" /> {isToday(due) ? "Today" : format(due, "MMM d")}
            </span>
          )}
          {progress && progress.total > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> {progress.done}/{progress.total}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
