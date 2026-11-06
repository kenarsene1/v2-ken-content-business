import { useDraggable } from "@dnd-kit/core";
import { Check, Flag } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { PlatformDot } from "@/components/bits";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SponsoredTag } from "./sponsored-tag";
import type { CalendarEvent as Event } from "@/lib/calendar";

export function CalendarEvent({ event, compact = false }: { event: Event; compact?: boolean }) {
  const openContent = useUI((s) => s.openContent);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: event.id, data: { event }, disabled: event.item.stage === "published" });
  const published = event.item.stage === "published" && event.kind === "publish";
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("min-w-0 touch-pan-y", isDragging && "opacity-30")}>
      <Button variant="ghost" aria-label={`${event.item.title} · ${event.kind === "due" ? "Due" : format(event.date, "p")}`} onClick={() => openContent(event.item.id)} title={`${event.item.title} · ${event.kind === "due" ? "Due" : format(event.date, "p")}`} className={cn("calendar-event h-auto w-full justify-start whitespace-normal rounded-md border-l-2 px-2 py-2 text-left font-normal", published ? "border-l-success bg-success-soft hover:bg-success-soft" : event.kind === "due" ? "border-l-muted-foreground bg-muted/65" : "border-l-primary bg-accent/65", compact && "py-1.5")}>
        {published ? <Check className="text-success" /> : event.kind === "due" ? <Flag className="text-muted-foreground" /> : <PlatformDot platform={event.item.platforms[0] ?? "other"} />}
        <span className={cn("min-w-0 flex-1", compact && "hidden sm:block")}><span className={cn("flex items-center gap-1 text-xs font-medium leading-snug", !compact && "items-start")}>{compact && <SponsoredTag videoId={event.item.id} dot />}<span className={cn("min-w-0", compact ? "truncate" : "line-clamp-2")}>{event.item.title}</span></span>{!compact && <span className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">{event.kind === "due" ? "Due date" : format(event.date, "p")}<SponsoredTag videoId={event.item.id} /></span>}</span>
      </Button>
    </div>
  );
}