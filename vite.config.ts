// Replaces @lovable.dev/vite-tanstack-config (removed in the Lovable migration, Phase 4).
// That wrapper bundled: tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro
// (cloudflare-module target), @tanstack/devtools-vite, VITE_* env injection, the @ path
// alias, React/TanStack dedupe, and optimizeDeps tuning — all genuine, generic Vite/
// TanStack config, wired up explicitly below instead.
//
// Deliberately NOT ported: hmrGatePlugin, devServerBridgePlugin (notably its
// /_sandbox/preview/execute endpoint, which let Lovable's editor run arbitrary JS in the
// live preview tab), lovableAssetsProxyPlugin, and the build-error-diagnostics/
// nodejs-compat-flag plugins — all gated behind Lovable's own sandbox detection and
// already inert outside their platform. Also dropped devServerFnErrorLogger/
// devSsrErrorLogger — these patched TanStack Start's internals to broadcast dev errors
// over a websocket, but their only consumer (lovable-error-reporting.ts) was removed in
// Phase 1, so they'd been firing into the void. The "componentTagger" mentioned in the
// old header comment doesn't exist anywhere in the installed package version (2.13.1) —
// nothing to port there.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type UserConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { devtools } from "@tanstack/devtools-vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load ALL env vars (no prefix) into process.env for server-side code (email routes need SUPABASE_SERVICE_ROLE_KEY).
// Do NOT expose these to the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig(({ command, mode }): UserConfig => {
  // VITE_*-prefixed vars, statically exposed to the client bundle as import.meta.env.VITE_*.
  const clientEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(clientEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  // True only for `npm run build:dev` (vite build --mode development).
  const isDevBuild = command === "build" && mode === "development";

  return {
    define: envDefine,
    environments: isDevBuild
      ? { client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } } }
      : undefined,
    // The old wrapper also set esbuild.keepNames here for isDevBuild — this Vite install's
    // ESBuildOptions type no longer has that field (Vite 8 shifted most transforms to
    // Rolldown), so it's dropped rather than typed past. Only affects the rarely-used
    // build:dev script.
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      watch: {
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
      },
    },
    plugins: [
      ...(mode === "development"
        ? [
            devtools({
              logging: false,
              eventBusConfig: { enabled: false },
              enhancedLogs: { enabled: false },
              consolePiping: { enabled: false },
              removeDevtoolsOnBuild: false,
              injectSource: { enabled: true },
            }),
          ]
        : []),
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this
        server: { entry: "server" },
      }),
      // nitro is build-only — the original wrapper never added it during `vite dev` either.
      ...(command === "build"
        ? [
            nitro({
              defaultPreset: "cloudflare-module",
              // Real Worker name (not the auto-generated ghostrecon226-cognarah-ai-launchpad
              // fallback) — persists across builds since it's baked in here, not passed
              // ad hoc on the CLI. nitro.options.cloudflare.wrangler is merged into the
              // generated wrangler.json with higher precedence than nitro's own defaults.
              //
              // limits.subrequests: explicit, not left to the account plan's implicit
              // default. The AI news agent's pipeline (search -> per-candidate
              // scrape/score/relevance-check/draft/refine, plus every Supabase call)
              // was hitting "Too many subrequests by single Worker invocation" and
              // getting killed as "hung" by the Workers runtime (confirmed live via
              // wrangler tail — Cloudflare error 1101) even after upgrading to Workers
              // Paid, which strongly suggested the account was still being metered at
              // the Free tier's 50-subrequest default rather than Paid's 10,000. Setting
              // this explicitly removes that ambiguity regardless of account/plan state.
              cloudflare: { wrangler: { name: "cognarah", limits: { subrequests: 10000 } } },
              rolldownConfig: {
                output: {
                  codeSplitting: {
                    // Nitro's SSR service pre-bundles TanStack Start's server entry into
                    // a single asset (.nitro/vite/services/ssr/assets/server-*.js), but
                    // Rolldown's default chunking then splits THAT one module into two
                    // output chunks that circularly re-export a synthetic __exportAll
                    // helper through each other. Under workerd's module loader that
                    // circular pair resolves with __exportAll still unassigned at call
                    // time (TypeError: __exportAll is not a function) — reproduces
                    // identically on wrangler dev, pre-existing before this fix. Forcing
                    // this one source module into a single named chunk removes the split
                    // (and the circularity) entirely; nitro's own node_modules group
                    // (for _libs/*) is untouched since this doesn't match that test.
                    groups: [{ test: (id: string) => /\/assets\/server-[\w-]+\.js$/.test(id), name: "server-entry" }],
                  },
                },
              },
            }),
          ]
        : []),
      viteReact(),
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        outDir: "dist/client",
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
  };
});
