import { Link } from "@tanstack/react-router";
import { Search, Menu, X } from "lucide-react";
import { useState } from "react";
import logoAsset from "@/assets/cognarah-logo.png.asset.json";
import { cn } from "@/lib/utils";

export const NAV_CATEGORIES = [
  { slug: "news", name: "News" },
  { slug: "startups", name: "Startups" },
  { slug: "funding", name: "Funding" },
  { slug: "tools", name: "Tools" },
  { slug: "trends", name: "Trends" },
  { slug: "opinions", name: "Opinions" },
  { slug: "analysis", name: "Analysis" },
  { slug: "interviews", name: "Interviews" },
  { slug: "africa-ai", name: "Africa AI", highlight: true },
  { slug: "policy-ethics", name: "Policy & Ethics" },
  { slug: "events", name: "Events" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-navy-foreground backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoAsset.url} alt="Cognarah" className="h-8 w-auto" />
          <span className="sr-only">Cognarah</span>
        </Link>
        <button
          className="lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {NAV_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white",
                c.highlight && "text-africa-foreground bg-africa/90 hover:bg-africa",
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
        <Link
          to="/search"
          className="hidden items-center justify-center rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white lg:flex"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Link>
      </div>
      {open && (
        <div className="border-t border-white/10 lg:hidden">
          <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-1 px-4 py-3 sm:grid-cols-3">
            {NAV_CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white",
                  c.highlight && "text-africa-foreground bg-africa/90",
                )}
              >
                {c.name}
              </Link>
            ))}
            <Link
              to="/search"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Search
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
