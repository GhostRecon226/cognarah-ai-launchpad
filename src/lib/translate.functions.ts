import { createServerFn } from "@tanstack/react-start";
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

export const translateArticle = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<TranslationResult> => {
    const { translateArticleImpl } = await import("./translate.server");
    return translateArticleImpl(data.slug, data.languageCode);
  });
