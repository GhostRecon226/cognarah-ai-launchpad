import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/cognarah-logo.png.asset.json";
import { NAV_CATEGORIES } from "./nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy text-navy-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoAsset.url} alt="Cognarah" className="h-9 w-auto" />
            </Link>
            <p className="mt-4 max-w-sm text-sm text-white/70">
              Everything AI. Nothing Else. Cognarah is the definitive media platform for everything artificial intelligence — news, startups, funding, policy, and the global builders shaping it.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Categories</h3>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/70">
              {NAV_CATEGORIES.slice(0, 8).map((c) => (
                <li key={c.slug}>
                  <Link to="/category/$slug" params={{ slug: c.slug }} className="hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Cognarah</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link to="/about" className="hover:text-white">About</Link></li>
              <li><Link to="/search" className="hover:text-white">Search</Link></li>
              <li><a href="mailto:hello@cognarah.com" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/50">
          © {new Date().getFullYear()} Cognarah. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
