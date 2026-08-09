import { useEffect, useRef } from "react";

/**
 * Fires a single first-party view event per article page view.
 * Client-only: never runs during SSR, and failures are silent.
 */
export function ViewTracker({ slug }: { slug: string }) {
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === slug) return;
    sent.current = slug;
    const params = new URLSearchParams(window.location.search);
    const payload = {
      slug,
      referrer: document.referrer || null,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
    };
    const timer = window.setTimeout(() => {
      fetch("/api/public/track/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => { /* analytics must never break the page */ });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [slug]);

  return null;
}
