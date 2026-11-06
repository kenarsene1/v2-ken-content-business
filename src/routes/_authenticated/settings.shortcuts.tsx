import { createFileRoute } from "@tanstack/react-router";
import { Kbd } from "@/components/bits";

export const Route = createFileRoute("/_authenticated/settings/shortcuts")({
  head: () => ({ meta: [{ title: "Shortcuts · Settings · My content B/S CRM" }, { name: "description", content: "Move through your creator workspace with quick keyboard shortcuts." }, { property: "og:title", content: "Shortcuts · Settings · My content B/S CRM" }, { property: "og:description", content: "Move through your creator workspace with quick keyboard shortcuts." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Shortcuts,
});

const ROWS: [string, string][] = [
  ["N", "New content, idea, challenge, goal, or profile on its page"],
  ["/", "Search"],
  ["⌘K", "Command menu"],
  ["G then D", "Go to Dashboard"],
  ["G then P", "Go to Working on"],
  ["G then C", "Go to Calendar"],
  ["G then I", "Go to Video ideas"],
  ["G then B", "Go to Brand deals"],
  ["G then R", "Go to Revenue"],
  ["G then H", "Go to Challenges"],
  ["G then O", "Go to Goals & plans"],
  ["G then A", "Go to Profiles"],
  ["G then S", "Go to Settings"],
];

function Shortcuts() {
  return (
    <section className="space-y-3">
      <h2 className="font-medium">Keyboard shortcuts</h2>
      <div className="divide-y rounded-lg border bg-card">
        {ROWS.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span>{label}</span>
            <Kbd>{k}</Kbd>
          </div>
        ))}
      </div>
    </section>
  );
}
