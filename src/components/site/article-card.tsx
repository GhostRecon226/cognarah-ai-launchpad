import { Link } from "@tanstack/react-router";
import type { Article } from "@/lib/types";
import { SITE_URL } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { MediaImage } from "@/components/site/media-image";
import { ArticleShare } from "@/components/site/article-share";

export function ArticleCard({
  article,
  size = "md",
}: {
  article: Article;
  size?: "sm" | "md" | "lg";
}) {
  const date = article.published_at ?? article.created_at;
  const aspect = size === "sm" ? "aspect-[16/9]" : "aspect-[16/10]";
  const headingClass =
    size === "lg"
      ? "text-2xl sm:text-3xl"
      : size === "sm"
        ? "text-base"
        : "text-lg";

  return (
    <article className="group flex flex-col">
      <Link
        to="/article/$slug"
        params={{ slug: article.slug }}
        className="overflow-hidden rounded-md bg-secondary"
      >
        <MediaImage
          src={article.hero_image}
          alt={article.title}
          className={`${aspect} w-full object-cover transition duration-500 group-hover:scale-105`}
          fallbackClassName={`${aspect} w-full`}
          loading="lazy"
          showIcon={false}
        />
      </Link>
      <div className={size === "sm" ? "mt-3 flex flex-col" : "mt-4 flex flex-col"}>
        {article.category && (
          <Link
            to="/category/$slug"
            params={{ slug: article.category.slug }}
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--category)] hover:text-foreground"
          >
            {article.category.name}
          </Link>
        )}
        <Link to="/article/$slug" params={{ slug: article.slug }}>
          <h3
            className={`font-display mt-1.5 leading-[1.15] text-foreground transition group-hover:text-[color:var(--brand)] ${headingClass}`}
          >
            {article.title}
          </h3>
        </Link>
        {article.excerpt && size === "lg" && (
          <p className="mt-3 text-base text-muted-foreground">{article.excerpt}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {article.author?.name && <span>{article.author.name}</span>}
          {article.author?.name && <span aria-hidden>·</span>}
          <time dateTime={date} suppressHydrationWarning>
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </time>
          <span aria-hidden>·</span>
          <span>{article.read_time} min</span>
        </div>
        <ArticleShare
          compact
          url={`${SITE_URL}/article/${article.slug}`}
          title={article.title}
        />
      </div>
    </article>
  );
}
