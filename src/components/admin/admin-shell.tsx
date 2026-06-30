import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/cognarah-logo.png.asset.json";
import { LayoutDashboard, FileText, Tags, Users, Image, Settings, LogOut, ExternalLink, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/articles", label: "Articles", icon: FileText },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/authors", label: "Authors", icon: Users },
  { to: "/admin/media", label: "Media", icon: Image },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const router = useRouter();
  const loc = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.navigate({ to: "/auth" });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [router]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy p-8 text-white">
        <img src={logoAsset.url} alt="Cognarah" className="h-10" />
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p className="max-w-md text-center text-white/70">
          Your account is signed in but is not authorized for the Cognarah CMS. Contact the site owner if this is unexpected.
        </p>
        <button onClick={signOut} className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">Sign out</button>
      </div>
    );
  }

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((n) => {
          const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <ExternalLink className="h-4 w-4" /> View site
        </a>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-secondary">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-navy text-navy-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <img src={logoAsset.url} alt="Cognarah" className="h-7" />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">CMS</span>
        </div>
        <NavList />
      </aside>

      {/* Mobile slide-in nav */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-navy text-navy-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <img src={logoAsset.url} alt="Cognarah" className="h-7" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60">CMS</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-secondary md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
          <button onClick={signOut} className="hidden text-sm text-muted-foreground hover:text-foreground md:hidden">
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
