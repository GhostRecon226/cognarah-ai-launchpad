// Server-only editorial intelligence helpers shared by the agent pipeline and
// the CMS promotion queue. Pure scoring logic, no external calls.

export interface PromotionInput {
  title: string;
  published_at: string | null;
  status: string;
  view_count: number;
  tracked_views_7d: number;
  newsworthiness_score: number | null;
  africa_relevance_score: number | null;
  is_featured: boolean;
  hero_image: string | null;
  body: string;
  key_takeaways: string[] | null;
  tags: string[] | null;
  promotions_count: number;
  last_promoted_at: string | null;
}

export interface PromotionResult {
  score: number;
  reason: string;
  signals: string[];
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / 86400000;
}

/**
 * Promotion score, 0 to 100. Higher means "promote this next".
 * It rewards fresh, strong, well packaged articles that have not been pushed
 * yet, and it penalises articles that were already promoted recently.
 */
export function computePromotionScore(a: PromotionInput): PromotionResult {
  const signals: string[] = [];
  let score = 0;

  // Editorial quality, up to 25.
  if (a.newsworthiness_score != null) {
    const q = Math.round((a.newsworthiness_score / 100) * 25);
    score += q;
    if (a.newsworthiness_score >= 70) signals.push(`High newsworthiness (${a.newsworthiness_score}/100)`);
    else if (a.newsworthiness_score < 45) signals.push(`Low newsworthiness (${a.newsworthiness_score}/100)`);
  } else {
    score += 12;
    signals.push("Newsworthiness not scored, using neutral baseline");
  }

  // Freshness, up to 25.
  const age = daysSince(a.published_at);
  if (age == null) {
    signals.push("Not published yet");
  } else if (age <= 1) {
    score += 25;
    signals.push("Published in the last 24 hours");
  } else if (age <= 3) {
    score += 20;
    signals.push("Published in the last 3 days");
  } else if (age <= 7) {
    score += 13;
    signals.push("Published this week");
  } else if (age <= 21) {
    score += 6;
    signals.push("Published this month");
  } else {
    signals.push("Older than three weeks");
  }

  // Early traction, up to 20. Momentum in the last 7 days matters more than lifetime totals.
  if (a.tracked_views_7d >= 200) { score += 20; signals.push(`Strong recent traction (${a.tracked_views_7d} views in 7 days)`); }
  else if (a.tracked_views_7d >= 60) { score += 14; signals.push(`Good recent traction (${a.tracked_views_7d} views in 7 days)`); }
  else if (a.tracked_views_7d >= 15) { score += 8; signals.push(`Some recent traction (${a.tracked_views_7d} views in 7 days)`); }
  else if (a.view_count >= 300) { score += 6; signals.push(`Proven lifetime performer (${a.view_count} views)`); }
  else if (age != null && age <= 3) { score += 6; signals.push("Too new to judge traction, worth a first push"); }
  else signals.push("Little traction so far");

  // African relevance, up to 12. Cognarah's differentiated angle travels well socially.
  const ar = a.africa_relevance_score ?? 0;
  if (ar >= 4) { score += 12; signals.push(`Strong African angle (relevance ${ar}/5)`); }
  else if (ar === 3) { score += 8; signals.push(`Clear African angle (relevance ${ar}/5)`); }
  else if (ar === 2) { score += 4; }

  // Packaging, up to 18.
  let packaging = 0;
  if (a.hero_image) { packaging += 6; } else { signals.push("No hero image, weaker social preview"); }
  const words = (a.body || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (words >= 900) packaging += 6;
  else if (words >= 500) packaging += 4;
  else signals.push(`Short article (${words} words)`);
  if ((a.key_takeaways ?? []).length >= 3) { packaging += 4; signals.push("Has takeaways, easy to turn into a post"); }
  if ((a.tags ?? []).length >= 3) packaging += 2;
  score += packaging;

  if (a.is_featured) { score += 5; signals.push("Featured on the homepage"); }

  // Promotion fatigue, penalty.
  const sinceLast = daysSince(a.last_promoted_at);
  if (a.promotions_count === 0) {
    score += 5;
    signals.push("Never promoted");
  } else if (sinceLast != null && sinceLast < 3) {
    score -= 30;
    signals.push(`Promoted ${Math.round(sinceLast * 24)} hours ago`);
  } else if (a.promotions_count >= 3) {
    score -= 15;
    signals.push(`Already promoted ${a.promotions_count} times`);
  } else {
    score -= 8;
    signals.push(`Promoted ${a.promotions_count} time(s) before`);
  }

  if (a.status !== "published") {
    score = Math.min(score, 20);
    signals.push("Draft, cannot be promoted until published");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const reason =
    score >= 75 ? "Promote now: strong, fresh and not yet pushed."
      : score >= 55 ? "Good candidate: worth a scheduled push this week."
        : score >= 35 ? "Optional: promote only if the queue is thin."
          : "Low priority: either stale, already pushed, or weak packaging.";

  return { score, reason, signals: signals.slice(0, 8) };
}
