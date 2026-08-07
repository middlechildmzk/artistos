import { Bot, Cable, CircleDollarSign, CircleHelp, PlugZap, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const settings = [
  [Cable, "Data sources", "Connect analytics providers, music accounts, public sources, and imports.", "/connections"],
  [PlugZap, "Integrations", "Manage partner platforms and submission workflows.", "/integrations"],
  [Bot, "Automations", "Choose which repeatable actions ArtistOS can prepare.", "/automations"],
  [ShieldCheck, "Approvals", "Review actions that require your decision.", "/approvals"],
  [SlidersHorizontal, "Workspace settings", "Manage your artist workspace and preferences.", "#workspace"],
  [CircleDollarSign, "Billing", "Review plan and billing information.", "#billing"],
  [CircleHelp, "Help", "See the product tour and learn the core workflow.", "/tour"],
] as const;

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const { data: workspace } = await supabase.from("workspaces").select("name").eq("id", membership.workspace_id).single();

  return (
    <>
      <AppHeader workspaceName={workspace?.name} />
      <main className="shell">
        <header className="app-page-heading">
          <div><div className="eyebrow">Workspace</div><h1>Settings</h1><p>Manage the services and preferences that support your day-to-day ArtistOS workflow.</p></div>
        </header>
        <section className="settings-grid">
          {settings.map(([Icon, title, description, href]) => (
            <Link className="card settings-card" href={href} id={title === "Billing" ? "billing" : title === "Workspace settings" ? "workspace" : undefined} key={title}>
              <span><Icon aria-hidden="true" size={18} /></span>
              <h2>{title}</h2>
              <p>{description}</p>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
