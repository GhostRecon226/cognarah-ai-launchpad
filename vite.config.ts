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

