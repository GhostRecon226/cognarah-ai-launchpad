import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/cognarah-logo-mark.png";

const FOOTER_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "news", name: "News" },
  { slug: "africa-ai", name: "Africa AI" },
  { slug: "policy-ethics", name: "Policy and Ethics" },
  { slug: "startups", name: "Startups" },
  { slug: "funding", name: "Funding Rounds" },
  { slug: "trends", name: "Trends" },
  { slug: "analysis", name: "Analysis" },
  { slug: "opinions", name: "Opinions" },
  { slug: "tools", name: "Tools" },
  { slug: "interviews", name: "Interviews" },
  { slug: "events", name: "Events" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy text-navy-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="inline-flex items-center">
              <img src={logoMark} alt="Cognarah" className="h-9 w-auto sm:h-10" />
            </Link>
            <p className="mt-5 max-w-sm text-sm text-white/70">
              Cognarah is the definitive media platform for everything artificial intelligence, news, startups, funding, policy, and the global builders shaping it.
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm uppercase tracking-wider text-white">Categories</h3>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/70">
              {FOOTER_CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    to="/category/$slug"
                    params={{ slug: c.slug }}
                    className="hover:text-[color:var(--brand-soft)]"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-sm uppercase tracking-wider text-white">Cognarah</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link to="/about" className="hover:text-[color:var(--brand-soft)]">About</Link></li>
              <li><Link to="/search" className="hover:text-[color:var(--brand-soft)]">Search</Link></li>
              <li><a href="mailto:hello@cognarah.com" className="hover:text-[color:var(--brand-soft)]">Contact</a></li>
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
