import { createServerFn, getRequest } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  slug: z.string().min(1),
  languageCode: z.string().min(2).max(20),
});

export interface TranslationResult {
  languageCode: string;
  title: string;
  body: string;
  cached: boolean;
}

// Keep these in sync with translate.server.ts, the UI reads them for copy and gating.
export const TRANSLATION_MAX_AGE_DAYS = 90;

export const translateArticle = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<TranslationResult> => {
    const request = getRequest();
    const ip =
      request.headers.get("cf-connecting-ip") ||
      (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
      "unknown";
    const { translateArticleImpl } = await import("./translate.server");
    return translateArticleImpl(data.slug, data.languageCode, ip);
  });

