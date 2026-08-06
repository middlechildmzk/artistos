import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleUserRound,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/dashboard/actions";

type AppDestination = "today" | "network" | "releases" | "campaigns" | "insights";

const primaryNavigation = [
  { key: "today", label: "Today", href: "/dashboard", icon: Sparkles },
  { key: "network", label: "Network", href: "/network", icon: Search },
  { key: "releases", label: "Releases", href: "/releases", icon: CalendarDays },
  { key: "campaigns", label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { key: "insights", label: "Insights", href: "/insights", icon: BarChart3 },
] as const;

const workspaceNavigation = [
  { label: "Connections", href: "/connections" },
  { label: "Integrations", href: "/integrations" },
  { label: "Automations", href: "/automations" },
  { label: "Approvals", href: "/approvals" },
  { label: "Workspace settings", href: "/settings" },
  { label: "Billing", href: "/settings?section=billing" },
  { label: "Help", href: "/tour" },
] as const;

export function AppHeader({
  active,
  workspaceName = "Artist workspace",
}: {
  active?: AppDestination;
  workspaceName?: string | null;
}) {
  return (
    <header className="app-header">
      <Link className="app-brand" href="/dashboard" aria-label="ArtistOS home">
        <span className="app-brand-mark" aria-hidden="true">A</span>
        <span className="app-brand-copy">
          <strong>ArtistOS</strong>
          <small>{workspaceName || "Artist workspace"}</small>
        </span>
      </Link>

      <nav className="app-primary-nav" aria-label="Primary navigation">
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              aria-current={active === item.key ? "page" : undefined}
              className={active === item.key ? "active" : undefined}
              href={item.href}
              key={item.key}
            >
              <Icon aria-hidden="true" size={16} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <details className="app-account-menu">
        <summary aria-label="Open workspace menu">
          <CircleUserRound aria-hidden="true" size={19} />
          <span>Workspace</span>
          <ChevronDown aria-hidden="true" size={14} />
        </summary>
        <div className="app-account-popover">
          <div className="app-account-heading">
            <strong>{workspaceName || "Artist workspace"}</strong>
            <span>Manage ArtistOS</span>
          </div>
          {workspaceNavigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </details>
    </header>
  );
}
