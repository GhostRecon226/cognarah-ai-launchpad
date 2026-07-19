import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

function pageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function Pagination({ currentPage, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null;
  const prev = currentPage - 1;
  const next = currentPage + 1;
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const pages = pageList(currentPage, totalPages);

  const baseLink =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition hover:bg-secondary";
  const activeLink = "bg-foreground text-background hover:bg-foreground";
  const disabledLink = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      <a
        href={prevDisabled ? undefined : buildHref(prev)}
        aria-label="Previous page"
        aria-disabled={prevDisabled || undefined}
        className={`${baseLink} ${prevDisabled ? disabledLink : ""}`}
      >
        <ChevronLeft className="h-4 w-4" />
      </a>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-2 text-sm text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <a
            key={p}
            href={buildHref(p)}
            aria-label={`Page ${p}`}
            aria-current={p === currentPage ? "page" : undefined}
            className={`${baseLink} ${p === currentPage ? activeLink : ""}`}
          >
            {p}
          </a>
        ),
      )}
      <a
        href={nextDisabled ? undefined : buildHref(next)}
        aria-label="Next page"
        aria-disabled={nextDisabled || undefined}
        className={`${baseLink} ${nextDisabled ? disabledLink : ""}`}
      >
        <ChevronRight className="h-4 w-4" />
      </a>
    </nav>
  );
}
