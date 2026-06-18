import { Link } from "@tanstack/react-router";
import type { Article } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export function ArticleCard({ article, size = "md" }: { article: Article; size?: "md" | "lg" }) {
  const date = article.published_at ?? article.created_at;
  return (
    <article className="group flex flex-col">
      <Link
        to="/article/$slug"
        params={{ slug: article.slug }}
        className="overflow-hidden rounded-lg bg-secondary"
      >
        {article.hero_image ? (
          <img
            src={article.hero_image}
            alt={article.title}
            className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-gradient-to-br from-navy to-brand" />
        )}
      </Link>
      <div className="mt-4 flex flex-col">
        {article.category && (
          <Link
            to="/category/$slug"
            params={{ slug: article.category.slug }}
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: article.category.color ?? undefined }}
          >
            {article.category.name}
          </Link>
        )}
        <Link to="/article/$slug" params={{ slug: article.slug }}>
          <h3
            className={`mt-2 font-bold tracking-tight text-foreground group-hover:text-brand ${
              size === "lg" ? "text-2xl sm:text-3xl" : "text-lg"
            }`}
          >
            {article.title}
          </h3>
        </Link>
        {article.excerpt && size === "lg" && (
          <p className="mt-3 text-base text-muted-foreground">{article.excerpt}</p>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {article.author?.name && <span>{article.author.name}</span>}
          {article.author?.name && <span aria-hidden>·</span>}
          <time dateTime={date}>{formatDistanceToNow(new Date(date), { addSuffix: true })}</time>
          <span aria-hidden>·</span>
          <span>{article.read_time} min read</span>
        </div>
      </div>
    </article>
  );
}
