import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/cognarah-logo.png.asset.json";
import { LayoutDashboard, FileText, Tags, Users, Image, Settings, LogOut, ExternalLink, Menu, X, Shield, RefreshCw, Sparkles, Rocket, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { RolesContext, type AppRole, ROLE_LABELS } from "@/lib/admin-roles";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; roles: AppRole[]; badgeKey?: "pendingStartups" };

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, roles: ["admin", "editor", "author"] },
  { to: "/admin/articles", label: "Articles", icon: FileText, roles: ["admin", "editor", "author"] },
  { to: "/admin/startups", label: "Startups", icon: Rocket, roles: ["admin", "editor"], badgeKey: "pendingStartups" },
  { to: "/admin/agent", label: "AI Agent", icon: Sparkles, roles: ["admin", "editor"] },
  { to: "/admin/categories", label: "Categories", icon: Tags, roles: ["admin", "editor"] },
  { to: "/admin/authors", label: "Authors", icon: Users, roles: ["admin", "editor"] },
  { to: "/admin/media", label: "Media", icon: Image, roles: ["admin", "editor", "author"] },
  { to: "/admin/subscribers", label: "Subscribers", icon: Mail, roles: ["admin"] },
  { to: "/admin/users", label: "Users", icon: Shield, roles: ["admin"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

interface Props {
  children: ReactNode;
  title: string;
  /** Roles allowed on this page. Defaults to all three. */
  requiredRoles?: AppRole[];
}

export function AdminShell({ children, title, requiredRoles = ["admin", "editor", "author"] }: Props) {
  const router = useRouter();
  const loc = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<AppRole[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingStartups, setPendingStartups] = useState<number>(0);

  const fetchRoles = useCallback(async (): Promise<boolean> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      router.navigate({ to: "/auth" });
      return false;
    }
    setUserId(u.user.id);
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    if (error) {
      setFetchError(error.message);
      setRoles([]);
      return false;
    }
    setFetchError(null);
    setRoles(((data ?? []).map((r: any) => r.role)) as AppRole[]);
    return true;
  }, [router]);

  useEffect(() => {
    fetchRoles();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        fetchRoles();
      } else if (event === "SIGNED_OUT") {
        router.navigate({ to: "/auth" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [fetchRoles, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!roles || !roles.some((r) => r === "admin" || r === "editor")) return;
    let cancelled = false;
    async function loadPending() {
      const { count } = await supabase
        .from("startup_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPendingStartups(count ?? 0);
    }
    loadPending();
    return () => { cancelled = true; };
  }, [roles, loc.pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  async function retry() {
    setRetrying(true);
    try {
      await fetchRoles();
    } finally {
      setRetrying(false);
    }
  }

  const authorized = useMemo(() => {
    if (!roles) return null;
    return roles.some((r) => requiredRoles.includes(r));
  }, [roles, requiredRoles]);

  if (roles === null || userId === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!authorized) {
    const hasAnyRole = roles.length > 0;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy p-8 text-white">
        <img src={logoAsset.url} alt="Cognarah" className="h-10" />
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p className="max-w-md text-center text-white/70">
          {hasAnyRole
            ? `Your role (${roles.map((r) => ROLE_LABELS[r]).join(", ")}) doesn't have access to this page. Required: ${requiredRoles.map((r) => ROLE_LABELS[r]).join(" or ")}.`
            : "Your account is signed in but hasn't been granted CMS access yet. If a role was just granted, click Retry."}
        </p>
        {fetchError && (
          <p className="max-w-md text-center text-xs text-white/40">Role lookup error: {fetchError}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={retry} disabled={retrying} className="flex items-center gap-2 rounded-md bg-white/15 px-4 py-2 hover:bg-white/25 disabled:opacity-60">
            <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} /> {retrying ? "Checking…" : "Retry"}
          </button>
          {hasAnyRole && (
            <Link to="/admin" className="rounded-md bg-white/15 px-4 py-2 hover:bg-white/25">Back to dashboard</Link>
          )}
          <button onClick={signOut} className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">Sign out</button>
        </div>
      </div>
    );
  }

  const visibleNav = NAV.filter((n) => n.roles.some((r) => roles.includes(r)));

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <nav className="flex-1 space-y-1 p-3">
        {visibleNav.map((n) => {
          const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
          const badge = n.badgeKey === "pendingStartups" ? pendingStartups : 0;
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
              <span className="flex-1">{n.label}</span>
              {badge > 0 && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-navy">{badge}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40">
          {roles.length ? roles.map((r) => ROLE_LABELS[r]).join(" · ") : "No role"}
        </div>
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
    <RolesContext.Provider
      value={{
        userId,
        roles,
        hasRole: (r) => roles.includes(r),
        hasAny: (rs) => rs.some((r) => roles.includes(r)),
      }}
    >
      <div className="flex min-h-screen bg-secondary">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-navy text-navy-foreground md:flex">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <img src={logoAsset.url} alt="Cognarah" className="h-7" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/60">CMS</span>
          </div>
          <NavList />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-navy text-navy-foreground shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <img src={logoAsset.url} alt="Cognarah" className="h-7" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/60">CMS</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
            <button onClick={() => setMobileOpen(true)} className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-secondary md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </RolesContext.Provider>
  );
}
