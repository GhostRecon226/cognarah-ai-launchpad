## Why hero image generation keeps failing

The AI News Agent calls the Lovable AI image endpoint with a Gemini model but uses the **OpenAI** request shape:

```ts
// src/lib/agent-core.server.ts, generateAiImage()
body: JSON.stringify({
  model: "google/gemini-2.5-flash-image",
  prompt,   // ← OpenAI-only field
})
```

Per the AI Gateway rules, Gemini image models on `/v1/images/generations` require the chat shape (`messages` + `modalities`). When `prompt` is sent to a Gemini model, the gateway returns HTTP 200 with a legacy-completions-shaped body that has **no `data[]` and no `b64_json`**. Our parser then reads `json?.data?.[0]?.b64_json`, gets `undefined`, and returns `null` — the agent logs "AI hero generation failed" and the draft is saved without a hero.

This matches what we see in the AI Gateway logs: recent `image_generations` calls all return 200 but no image lands in storage.

## Fix

Edit only `generateAiImage()` in `src/lib/agent-core.server.ts`:

1. Send the Gemini-correct body:
   ```ts
   {
     model: "google/gemini-3.1-flash-image", // latest Nano Banana 2, fast + high quality
     messages: [{ role: "user", content: prompt }],
     modalities: ["image", "text"]
   }
   ```
   (Upgrading from `gemini-2.5-flash-image` to `gemini-3.1-flash-image` in the same edit — newer generation, same response shape.)

2. Keep response parsing as `json?.data?.[0]?.b64_json` — the gateway normalizes Gemini image responses into the OpenAI-images shape, so this field is the correct one once the request body is right.

3. Improve failure diagnostics so the run log tells us *why* it failed instead of a silent `null`:
   - On non-2xx, log `status` + a short response body snippet via the existing `logLine` pathway (return `null` from `generateAiImage` but include the reason in the thrown/returned info).
   - On 2xx with no `b64_json`, log the top-level keys of the response so future regressions surface immediately.

   Concretely: change `generateAiImage` to return `{ buf: Buffer } | { error: string }` (or keep `Buffer | null` and thread an out-param), and update the single call site around line 598 to log the reason before falling through.

## Scope

- Only file touched: `src/lib/agent-core.server.ts` (function `generateAiImage` + the ~2 lines at its call site that log the outcome).
- No schema, RLS, UI, or route changes.
- No changes to source-image sniffing, vision relevance check, or upload path.

## Verification

1. Open **Admin → AI Agent**, click **Run agent** with count=1.
2. Expand the run log. Expect either:
   - `Hero: source image used …` (unchanged path), or
   - `Falling back to AI-generated hero` → `AI hero generated` (previously failing path, now succeeds), and the new draft in Articles has a hero image populated.
3. If it still fails, the new diagnostic line in the log will show the exact HTTP status / missing field so we can iterate.
