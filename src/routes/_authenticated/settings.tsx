import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Archive, Keyboard, Palette, UserCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · My content B/S CRM" },
      { name: "description", content: "Manage profiles, appearance, shortcuts and your sign-in." },
      { property: "og:title", content: "Settings · My content B/S CRM" },
      { property: "og:description", content: "Manage profiles, appearance, shortcuts and your sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsLayout,
});

const SECTIONS = [
  { to: "/settings/profiles", label: "Profiles", icon: Users, hint: "Channels and accounts" },
  { to: "/settings/appearance", label: "Appearance", icon: Palette, hint: "Theme" },
  { to: "/settings/backup", label: "Backup & export", icon: Archive, hint: "Your saved records" },
  { to: "/settings/shortcuts", label: "Shortcuts", icon: Keyboard, hint: "Keyboard" },
  { to: "/settings/account", label: "Your account", icon: UserCircle, hint: "Sign-in" },
] as const;

function SettingsLayout() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-xl font-semibold">Settings</h1>
      <div className="flex flex-col gap-8 md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col">
          {SECTIONS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: cn("bg-accent font-medium text-primary") }}
            >
              <s.icon className="h-4 w-4" /> {s.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
