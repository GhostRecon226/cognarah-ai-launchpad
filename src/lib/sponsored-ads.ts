import { supabase } from "@/integrations/supabase/client";

export type AdPlacement = "startups_listing_top" | "article_inline";

export interface SponsoredAd {
  id: string;
  advertiser_name: string;
  image_url: string;
  destination_url: string;
  placement: AdPlacement;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  startups_listing_top: "Startups listing top",
  article_inline: "Article inline",
};

/** Category slugs that make up the Startups and Funding section. */
export const STARTUP_SECTION_SLUGS = ["startups", "funding"];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Rewrites a stored sponsored ad image reference to the app served redirect path. */
export function sponsoredAdImageUrl(input?: string | null): string {
  if (!input) return "";
  if (input.startsWith("/api/public/sponsored-ads/")) return input;
  const m = input.match(/\/storage\/v1\/object\/(?:public|sign)\/sponsored-ads\/([^?#]+)/);
  if (m) return `/api/public/sponsored-ads/${m[1]}`;
  return input;
}

/** Returns the most recent live ad for a placement, or null when none is running. */
export async function fetchLiveAd(placement: AdPlacement): Promise<SponsoredAd | null> {
  const today = todayIso();
  const { data } = await supabase
    .from("sponsored_ads")
    .select("*")
    .eq("placement", placement)
    .eq("active", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SponsoredAd | null) ?? null;
}
