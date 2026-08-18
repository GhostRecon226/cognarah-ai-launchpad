import { sponsoredAdImageUrl, PLACEMENT_SPECS, type SponsoredAd } from "@/lib/sponsored-ads";

interface Props {
  ad: SponsoredAd | null | undefined;
  className?: string;
}

/**
 * Renders a paid sponsored banner with a clear disclosure label.
 * Renders nothing when there is no live ad for the placement.
 */
export function SponsoredBanner({ ad, className }: Props) {
  if (!ad) return null;
  const src = sponsoredAdImageUrl(ad.image_url);
  if (!src) return null;

  return (
    <aside
      className={`w-full ${className ?? ""}`}
      aria-label={`Sponsored by ${ad.advertiser_name}`}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Sponsored
      </p>
      <a
        href={ad.destination_url}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-border bg-secondary"
      >
        <img
          src={src}
          alt={`Sponsored banner by ${ad.advertiser_name}`}
          className="aspect-[7/1] w-full object-cover"
          loading="lazy"
        />
      </a>
    </aside>
  );
}
