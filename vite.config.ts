// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load ALL env vars (no prefix) into process.env for server-side code (email routes need SUPABASE_SERVICE_ROLE_KEY).
// Do NOT expose these to the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        manifest: false,
        devOptions: { enabled: false },
        includeAssets: ["offline.html", "favicon.png", "icon-192.png", "icon-512.png"],
        workbox: {
          globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico,html}"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }: { request: Request; url: URL }) =>
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
              urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
                sameOrigin && ["style", "script", "font"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "cognarah-assets",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ request }: { request: Request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "cognarah-images",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        // html-to-text's nested htmlparser2 imports `entities/lib/decode.js`, a v4-only subpath.
        // Root `entities` is v7 and doesn't ship that file, so point these subpaths at the
        // nested v4 copy that html-to-text/htmlparser2 actually needs.
        "entities/lib/decode.js": path.resolve(
          __dirname,
          "node_modules/html-to-text/node_modules/htmlparser2/node_modules/entities/lib/esm/decode.js",
        ),
        "entities/lib/escape.js": path.resolve(
          __dirname,
          "node_modules/html-to-text/node_modules/htmlparser2/node_modules/entities/lib/esm/escape.js",
        ),
      },
    },
  },
});


