import { Link } from "@tanstack/react-router";
import { Search, Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import logoAsset from "@/assets/cognarah-logo.png.asset.json";
import { cn } from "@/lib/utils";

type NavChild = {
  name: string;
  to: "/category/$slug" | "/";
  slug?: string;
  highlight?: boolean;
};

type NavGroup = {
  label: string;
  children: NavChild[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "News",
    children: [
      { name: "Latest News", to: "/category/$slug", slug: "news" },
      { name: "Africa AI", to: "/category/$slug", slug: "africa-ai", highlight: true },
      { name: "Policy & Ethics", to: "/category/$slug", slug: "policy-ethics" },
    ],
  },
  {
    label: "Startups & Funding",
    children: [
      { name: "Startups", to: "/category/$slug", slug: "startups" },
      { name: "Funding Rounds", to: "/category/$slug", slug: "funding" },
    ],
  },
  {
    label: "Insights",
    children: [
      { name: "Trends", to: "/category/$slug", slug: "trends" },
      { name: "Analysis", to: "/category/$slug", slug: "analysis" },
      { name: "Opinions", to: "/category/$slug", slug: "opinions" },
    ],
  },
  {
    label: "Resources",
    children: [
      { name: "Tools", to: "/category/$slug", slug: "tools" },
      { name: "Interviews", to: "/category/$slug", slug: "interviews" },
    ],
  },
  {
    label: "Events",
    children: [
      { name: "Upcoming Events", to: "/category/$slug", slug: "events" },
      { name: "AI Summit", to: "/category/$slug", slug: "events" },
    ],
  },
];

// Back-compat export (some files import NAV_CATEGORIES)
export const NAV_CATEGORIES = NAV_GROUPS.flatMap((g) =>
  g.children.map((c) => ({ slug: c.slug!, name: c.name, highlight: c.highlight })),
);

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [mobileOpenIdx, setMobileOpenIdx] = useState<number | null>(null);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-navy-foreground backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logoAsset.url} alt="Cognarah" className="h-16 w-auto sm:h-20" />
          <span className="sr-only">Cognarah</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="group relative">
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                {group.label}
                <ChevronDown className="h-3.5 w-3.5 transition group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="overflow-hidden rounded-md border border-white/10 bg-navy shadow-xl ring-1 ring-black/40">
                  {group.children.map((child) => (
                    <Link
                      key={`${group.label}-${child.name}`}
                      to={child.to}
                      params={child.slug ? { slug: child.slug } : undefined}
                      className={cn(
                        "block px-4 py-2.5 text-sm text-white/85 transition hover:bg-white/5 hover:text-brand",
                        child.highlight && "text-africa-foreground bg-africa/80 hover:bg-africa hover:text-white",
                      )}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/search"
            className="hidden items-center justify-center rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white lg:flex"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Link>
          <button
            className="lg:hidden text-white"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 lg:hidden">
          <nav className="mx-auto max-w-7xl px-4 py-2">
            {NAV_GROUPS.map((group, idx) => {
              const isOpen = mobileOpenIdx === idx;
              return (
                <div key={group.label} className="border-b border-white/5 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setMobileOpenIdx(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between px-2 py-3 text-sm font-medium text-white"
                  >
                    {group.label}
                    <ChevronDown
                      className={cn("h-4 w-4 transition", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && (
                    <div className="pb-2 pl-3">
                      {group.children.map((child) => (
                        <Link
                          key={`${group.label}-m-${child.name}`}
                          to={child.to}
                          params={child.slug ? { slug: child.slug } : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-brand",
                            child.highlight && "text-africa-foreground bg-africa/80",
                          )}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <Link
              to="/search"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              <Search className="h-4 w-4" /> Search
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
