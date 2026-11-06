import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  head: () => ({ meta: [{ title: "Appearance · Settings · My content B/S CRM" }, { name: "description", content: "Choose a light, dark, or device-matched theme for your creative workspace." }, { property: "og:title", content: "Appearance · Settings · My content B/S CRM" }, { property: "og:description", content: "Choose a light, dark, or device-matched theme for your creative workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Appearance,
});

const OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Match my device", icon: Monitor },
] as const;

function Appearance() {
  const { theme, setTheme } = useUI();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-medium">Theme</h2>
        <p className="text-sm text-muted-foreground">Choose how My content B/S CRM looks.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setTheme(o.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-card p-4 text-sm transition-colors hover:border-primary/40",
              theme === o.id && "border-primary font-medium",
            )}
          >
            <o.icon className="h-4 w-4" /> {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
