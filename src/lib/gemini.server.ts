// Direct calls to Google's Gemini API, replacing the old ai.gateway.lovable.dev proxy.
// The proxy took OpenAI-style {model: "google/<id>", messages, response_format} and forwarded
// to Google under the hood; this calls the same underlying model natively instead, using
// Gemini's own request/response shape (systemInstruction/contents/generationConfig, not
// messages/response_format; candidates[0].content.parts[].text, not choices[0].message.content).
//
// REQUIRES: GEMINI_API_KEY (Google AI Studio / Vertex) — see LOVABLE-MIGRATION.md Phase 2a.
//
// Using gemini-3.6-flash, not the newer gemini-3.7-flash: 3.7 returned a persistent
// 503 "high demand" from Google across repeated attempts on 2026-08-30 (confirmed not
// an auth/wiring issue — 3.6 succeeded immediately with the same key). Google's own API
// also names 3.6 as the current replacement in gemini-2.5-flash's deprecation notice.
// Worth revisiting once 3.7 capacity settles.
const GEMINI_MODEL = "gemini-3.6-flash";

export async function callGeminiJSON(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API ${res.status}: ${t.slice(0, 300)}`);
  }

  const json: any = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.filter((p: any) => typeof p?.text === "string").map((p: any) => p.text).join("")
    : "";
  if (!text) {
    const reason = json?.candidates?.[0]?.finishReason ?? json?.promptFeedback?.blockReason ?? "unknown";
    throw new Error(`Gemini API returned no text (reason: ${reason})`);
  }
  return text;
}
