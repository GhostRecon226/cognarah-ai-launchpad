import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENT } from "@/lib/adsense";
import { useIsMobile } from "@/hooks/use-mobile";

type AdPosition = "in-article" | "homepage-banner" | "sidebar";

interface AdUnitProps {
  slot: string;
  position: AdPosition;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdUnit({ slot, position, className }: AdUnitProps) {
  const isMobile = useIsMobile();
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    if (position === "sidebar" && isMobile) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      // Ad blockers or SSR hydration issues can throw; safe to ignore.
      console.warn("[adsense] push failed", e);
    }
  }, [position, isMobile]);

  // Sidebar: desktop-only. Don't render at all on mobile.
  if (position === "sidebar" && isMobile) return null;

  const wrapperClass =
    position === "sidebar"
      ? "hidden md:block"
      : position === "homepage-banner"
        ? "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6"
        : "my-8 w-full";

  const insStyle: React.CSSProperties =
    position === "sidebar"
      ? { display: "inline-block", width: 300, height: 600 }
      : { display: "block", textAlign: "center" };

  const dataAttrs: Record<string, string> =
    position === "in-article"
      ? { "data-ad-layout": "in-article", "data-ad-format": "fluid" }
      : position === "homepage-banner"
        ? { "data-ad-format": "auto", "data-full-width-responsive": "true" }
        : {};

  return (
    <aside
      className={`${wrapperClass} ${className ?? ""}`}
      aria-label="Advertisement"
    >
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Advertisement
      </p>
      <ins
        className="adsbygoogle"
        style={insStyle}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        {...dataAttrs}
      />
    </aside>
  );
}
