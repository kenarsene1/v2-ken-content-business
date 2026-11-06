import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Grip, Library, Lightbulb, Plus, Target, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const APPS = [
  { to: "/library", label: "Library", icon: Library, color: "text-chart-1" },
  { to: "/goals", label: "Goals", icon: Target, color: "text-chart-5" },
  { to: "/revenue", label: "Revenue", icon: Wallet, color: "text-chart-2" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, color: "text-primary" },
] as const;

/** Pages in the desktop sidebar that don't fit the mobile tab bar. */
const MOBILE_APPS = [
  { to: "/ideas", label: "Video ideas", icon: Lightbulb, color: "text-chart-4" },
] as const;

/** Turns "example.com/x" into a safe https URL, or null if invalid. */
export function normalizeLink(raw: string): URL | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url;
  } catch { return null; }
}

function defaultName(url: URL) {
  const base = url.hostname.replace(/^www\./, "").split(".")[0] ?? "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const iconFor = (url: string) => {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return ""; }
};

function useLinks() {
  return useQuery({
    queryKey: ["quick_links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quick_links").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function MoreApps({ collapsed = false, mobile = false }: { collapsed?: boolean; mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const path = useRouterState({ select: (state) => state.location.pathname });
  const apps = mobile ? [...MOBILE_APPS, ...APPS] : APPS;
  const active = apps.some((app) => path.startsWith(app.to));
  const qc = useQueryClient();
  const { data: links } = useLinks();

  const add = useMutation({
    mutationFn: async (row: { name: string; url: string }) => {
      const { error } = await supabase.from("quick_links").insert(row);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quick_links"] }); setAdding(false); setUrl(""); setName(""); },
    onError: () => toast.error("Couldn't save link"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick_links"] }),
  });

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { if (!open) setAdding(false); }, [open]);

  const parsed = normalizeLink(url);
  const tile = "group relative flex h-auto min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-xs transition-colors hover:bg-muted";
  const iconBox = "flex h-9 w-9 items-center justify-center rounded-xl border bg-muted/30 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transform-none [&_svg]:size-4";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label="More apps"
          title="More apps"
          className={cn(
            mobile
              ? "h-full min-w-0 flex-1 flex-col gap-1 rounded-none px-1 text-[11px] [&_svg]:size-5"
              : "h-10 w-full justify-start gap-2.5 px-2 text-sm font-normal",
            active || open
              ? mobile ? "text-primary" : "bg-sidebar-accent font-medium text-foreground"
              : "text-muted-foreground",
            "hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Grip className="shrink-0" />
          {(!collapsed || mobile) && <span>More</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="More apps"
        side={mobile ? "top" : "right"}
        align={mobile ? "end" : "start"}
        sideOffset={12}
        collisionPadding={12}
        className="more-apps-panel w-[240px] max-w-[calc(100vw-24px)] rounded-2xl border border-border shadow-panel bg-popover p-2 duration-200 motion-reduce:animate-none"
      >
        <div className="grid grid-cols-3 gap-2">
          {apps.map((app) => (
            <Button
              key={app.to}
              asChild
              variant="ghost"
              className={cn(tile, path.startsWith(app.to) && "bg-accent text-accent-foreground")}
            >
              <Link to={app.to} onClick={() => setOpen(false)} aria-current={path.startsWith(app.to) ? "page" : undefined}>
                <span className={cn(iconBox, app.color)}><app.icon strokeWidth={2.2} /></span>
                <span>{app.label}</span>
              </Link>
            </Button>
          ))}
          {links?.map((l) => (
            <div key={l.id} className={tile}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url} className="flex w-full min-w-0 flex-col items-center gap-2" onClick={() => setOpen(false)}>
                <span className={iconBox}>
                  <img src={iconFor(l.url)} alt="" className="h-5 w-5 rounded" loading="lazy" />
                </span>
                <span className="w-full truncate text-center">{l.name}</span>
              </a>
              <button
                type="button"
                aria-label={`Remove ${l.name}`}
                onClick={() => remove.mutate(l.id)}
                className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-card text-muted-foreground shadow-surface hover:text-foreground group-hover:flex"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button type="button" aria-label="Add link" title="Add link" onClick={() => setAdding((v) => !v)} className={cn(tile, "text-muted-foreground")}>
            <span className={cn(iconBox, "border-dashed")}><Plus /></span>
            <span>Link</span>
          </button>
        </div>
        {adding && (
          <form
            className="mt-2 space-y-2 border-t pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!parsed) { toast.error("Enter a valid link"); return; }
              add.mutate({ url: parsed.toString(), name: name.trim() || defaultName(parsed) });
            }}
          >
            <Input autoFocus placeholder="Paste link" value={url} onChange={(e) => setUrl(e.target.value)} className="h-9 text-sm" />
            <Input placeholder={parsed ? defaultName(parsed) : "Name (optional)"} value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
            <Button type="submit" size="sm" className="w-full" disabled={!parsed || add.isPending}>Add link</Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
