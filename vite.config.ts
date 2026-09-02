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
import { devtools } from "@tanstack/devtools-vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicit cache-control for plain SSR/document routes (previously unset,
// falling back to browser/CDN heuristics). "must-revalidate" rather than a
// real max-age since content changes on publish, not on a fixed schedule;
// still lets conditional requests (304) avoid a full re-fetch.
//
// Listed as explicit, non-overlapping path patterns rather than a single
// "/**" catch-all: Cloudflare's Worker Static Assets _headers mechanism
// (which is what nitro's routeRules compiles to) does NOT apply "most
// specific path wins" the way Cloudflare Pages' _headers does — verified
// empirically that a "/**" rule instead gets literally concatenated onto
// whatever a more specific matching rule already set, corrupting it (e.g.
// "public, max-age=31536000, immutable, TEST-CATCHALL-DELETE-ME" on the
// hashed /assets/* files, which already have their own correct immutable
// rule). Each pattern below is structurally disjoint from /assets/** and
// from the routes that set their own Cache-Control in-handler (sitemap.xml,
// llms-full.txt, the media redirect), so there's nothing for it to collide
// with regardless of Cloudflare's exact merge semantics.
const SSR_PAGE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const SSR_PAGE_PATTERNS = [
  "/", "/about", "/search", "/state-of-african-ai",
  "/article/**", "/category/**", "/authors/**", "/resources/**", "/startups/**",
];

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
      viteReact(),
      // The service worker is generated as an explicit post-build step against
      // .output/public (scripts/generate-sw.mjs, run from package.json's "build"
      // script), not via a vite-plugin-pwa build hook here. dist/client is not the
      // real deployed client output in this pipeline — nitro's buildApp hook builds
      // the client environment separately and copies the result straight into
      // .output/public, so a same-phase closeBundle-based plugin (which is how
      // vite-plugin-pwa's generateSW works) has nothing to scan. See
      // scripts/generate-sw.mjs for the full explanation and history.
      // nitro is build-only — the original wrapper never added it during `vite dev` either.
      ...(command === "build"
        ? [
            nitro({
              defaultPreset: "cloudflare-module",
              // Nitro's own default is "latest", which resolves to the current date at
              // EVERY build — meaning each deploy could silently pick up unreviewed
              // Workers runtime behavior changes with no corresponding code change to
              // review. Pinned to a specific date instead; bump deliberately.
              compatibilityDate: "2026-09-02",
              routeRules: Object.fromEntries(
                SSR_PAGE_PATTERNS.map((p) => [p, { headers: { "cache-control": SSR_PAGE_CACHE_CONTROL } } as any]),
              ),
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
              //
              // limits.cpu_ms: same reasoning, set explicitly rather than trusting the
              // account plan's implicit default (Paid defaults to 30s, same class of
              // ambiguity that bit the subrequests limit above). Set to Paid's 5-minute
              // max since the agent webhook is the one route that could plausibly need
              // it, even though its wall-clock runtime is mostly spent awaiting external
              // API calls rather than active CPU time.
              cloudflare: { wrangler: { name: "cognarah", limits: { subrequests: 10000, cpu_ms: 300000 } } },
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
    ],
  };
});
