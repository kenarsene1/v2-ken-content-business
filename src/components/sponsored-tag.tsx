import { useSponsors } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Tiny "Sponsored" marker for a video linked to a brand deal. Renders nothing for other videos.
 * The brand comes from the shared deals cache (useSponsors), so adding it to any list costs no extra requests.
 */
export function SponsoredTag({ videoId, dot = false, className }: { videoId: string; dot?: boolean; className?: string }) {
  const brand = useSponsors().get(videoId);
  if (!brand) return null;
  if (dot) {
    return (
      <span title={`Sponsored by ${brand}`} className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning", className)}>
        <span className="sr-only">Sponsored by {brand}</span>
      </span>
    );
  }
  return (
    <span
      title={`Sponsored by ${brand}`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-[4px] bg-warning-soft px-1 align-middle text-[9px] font-semibold uppercase leading-[14px] tracking-wide text-warning",
        className,
      )}
    >
      Sponsored
      <span className="sr-only"> by {brand}</span>
    </span>
  );
}
