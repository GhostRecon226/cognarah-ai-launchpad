// Generates the service worker as an explicit post-build step against
// .output/public — the directory Cloudflare Workers actually serves from —
// rather than as a vite-plugin-pwa build hook targeting dist/client.
//
// dist/client is NOT the real deployed client output in this pipeline:
// nitro's buildApp hook (Vite's multi-environment build orchestration)
// builds the client environment into its own internal location and copies
// the result into .output/public directly; dist/client ends up empty of
// real assets by the time any same-phase closeBundle hook (which is what
// vite-plugin-pwa's generateSW relies on) would run. Confirmed both by the
// build log ("glob pattern doesn't match any files", precache 0 entries)
// and live: https://cognarah.com/sw.js was a 404 in production before this
// fix, despite the build reporting success. Reordering plugin registration
// did not help, since this isn't a closeBundle ordering race at all.
//
// Run after `vite build` (see package.json's "build" script), once
// .output/public is guaranteed fully populated.
import { generateSW } from "workbox-build";
import { existsSync } from "node:fs";

const globDirectory = ".output/public";

if (!existsSync(globDirectory)) {
  console.error(`[generate-sw] ${globDirectory} does not exist — run vite build first.`);
  process.exit(1);
}

const { count, size, warnings } = await generateSW({
  globDirectory,
  globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico,html}"],
  swDest: `${globDirectory}/sw.js`,
  navigateFallback: null,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        request.mode === "navigate" &&
        !url.pathname.startsWith("/~oauth") &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/admin") &&
        !url.pathname.startsWith("/auth"),
      handler: "NetworkFirst",
      options: {
        cacheName: "cognarah-pages",
        networkTimeoutSeconds: 8,
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 },
        cacheableResponse: { statuses: [200] },
        precacheFallback: { fallbackURL: "/offline.html" },
      },
    },
    {
      urlPattern: ({ request, sameOrigin }) =>
        sameOrigin && ["style", "script", "font"].includes(request.destination),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "cognarah-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "cognarah-images",
        expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

if (warnings.length > 0) {
  console.warn("[generate-sw] warnings:", warnings);
}
console.log(`[generate-sw] precached ${count} files, ${(size / 1024).toFixed(1)} KiB, -> ${globDirectory}/sw.js`);
