import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import slugify from "slugify";
import { stripEmDashes, stripEmDashesInObject } from "./strip-em-dashes";

const ALLOWED_STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+"];
const ALLOWED_TEAM = ["1-5", "6-15", "16-50", "50+"];
const ALLOWED_REVENUE = ["Pre-revenue", "Early revenue", "Growing revenue"];
const ALLOWED_CONTACT = ["Email", "LinkedIn", "WhatsApp"];
const ALLOWED_TECH = [
  "Large Language Models",
  "Computer Vision",
  "Natural Language Processing",
  "Predictive Analytics",
  "Robotics",
  "Other",
];

export type StartupSubmissionInput = {
  company_name: string;
  website_url: string;
  country: string;
  city: string;
  year_founded: number;
  company_stage: string;
  product_description: string;
  problem_solved: string;
  target_audience: string;
  ai_technologies: string[];
  founder_name: string;
  founder_linkedin?: string;
  team_size: string;
  user_count?: string;
  revenue_stage: string;
  funding_raised?: string;
  notable_investors?: string;
  partnerships?: string;
  product_demo?: string;
  press_links?: string;
  founder_email: string;
  contact_method: string;
  whatsapp_number?: string;
  consent: boolean;
  logo_file_base64: string;
  logo_file_name: string;
  logo_file_type: string;
};

function req(v: unknown, name: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error(`${name} is required`);
  return s;
}

export const submitStartup = createServerFn({ method: "POST" })
  .inputValidator((data: StartupSubmissionInput) => {
    if (!data || typeof data !== "object") throw new Error("Invalid payload");
    if (!data.consent) throw new Error("Consent is required");
    if (!/^\S+@\S+\.\S+$/.test(data.founder_email || "")) throw new Error("Valid founder email required");
    const year = Number(data.year_founded);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      throw new Error("Valid year founded required");
    }
    if (!ALLOWED_STAGES.includes(data.company_stage)) throw new Error("Invalid company stage");
    if (!ALLOWED_TEAM.includes(data.team_size)) throw new Error("Invalid team size");
    if (!ALLOWED_REVENUE.includes(data.revenue_stage)) throw new Error("Invalid revenue stage");
    if (!ALLOWED_CONTACT.includes(data.contact_method)) throw new Error("Invalid contact method");
    if (data.contact_method === "WhatsApp" && !(data.whatsapp_number || "").trim()) {
      throw new Error("WhatsApp number required");
    }
    const techs = Array.isArray(data.ai_technologies) ? data.ai_technologies.filter((t) => ALLOWED_TECH.includes(t)) : [];
    if (techs.length === 0) throw new Error("Select at least one AI technology");
    if ((data.product_description || "").length > 300) throw new Error("Product description too long");
    if ((data.problem_solved || "").length > 300) throw new Error("Problem description too long");
    if (!data.logo_file_base64 || !data.logo_file_name) throw new Error("Logo is required");
    if (!/^image\//.test(data.logo_file_type || "")) throw new Error("Logo must be an image");

    return {
      ...data,
      year_founded: year,
      ai_technologies: techs,
      company_name: req(data.company_name, "Company name"),
      website_url: req(data.website_url, "Website URL"),
      country: req(data.country, "Country"),
      city: req(data.city, "City"),
      product_description: req(data.product_description, "Product description"),
      problem_solved: req(data.problem_solved, "Problem solved"),
      target_audience: req(data.target_audience, "Target audience"),
      founder_name: req(data.founder_name, "Founder name"),
      founder_email: data.founder_email.trim().toLowerCase(),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Decode base64 logo (allow "data:...;base64,xxx" or raw)
    const b64 = data.logo_file_base64.includes(",")
      ? data.logo_file_base64.split(",").pop()!
      : data.logo_file_base64;
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length > 2 * 1024 * 1024) throw new Error("Logo exceeds 2MB");

    const safeName = data.logo_file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `startup-logos/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("media")
      .upload(path, bytes, { contentType: data.logo_file_type, upsert: false });
    if (upErr) throw new Error(`Logo upload failed: ${upErr.message}`);

    const logo_url = `/api/public/media/${path}`;

    const row = stripEmDashesInObject(
      {
      company_name: data.company_name,
      website_url: data.website_url,
      country: data.country,
      city: data.city,
      year_founded: data.year_founded,
      company_stage: data.company_stage,
      product_description: data.product_description,
      problem_solved: data.problem_solved,
      target_audience: data.target_audience,
      ai_technologies: data.ai_technologies,
      founder_name: data.founder_name,
      founder_linkedin: data.founder_linkedin || null,
      team_size: data.team_size,
      user_count: data.user_count || null,
      revenue_stage: data.revenue_stage,
      funding_raised: data.funding_raised || null,
      notable_investors: data.notable_investors || null,
      partnerships: data.partnerships || null,
      logo_url,
      product_demo: data.product_demo || null,
      press_links: data.press_links || null,
      founder_email: data.founder_email,
      contact_method: data.contact_method,
      whatsapp_number: data.contact_method === "WhatsApp" ? data.whatsapp_number || null : null,
      consent: true,
      },
      [
        "company_name",
        "website_url",
        "country",
        "city",
        "product_description",
        "problem_solved",
        "target_audience",
        "founder_name",
        "notable_investors",
        "partnerships",
        "press_links",
      ],
    );

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("startup_submissions")
      .insert(row)
      .select("id, submitted_at")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Notify admins (fire-and-forget; never block submission on email failure).
    try {
      const { enqueueTransactionalEmail } = await import("@/lib/email/enqueue-internal.server");
      await enqueueTransactionalEmail({
        templateName: "startup-submission-notification",
        idempotencyKey: `startup-submission-${inserted.id}`,
        templateData: {
          companyName: row.company_name,
          founderName: row.founder_name,
          country: row.country,
          city: row.city,
          companyStage: row.company_stage,
          productDescription: row.product_description,
          problemSolved: row.problem_solved,
          founderEmail: row.founder_email,
          contactMethod: row.contact_method,
          whatsappNumber: row.whatsapp_number,
          submittedAt: inserted.submitted_at,
          reviewUrl: "https://cognarah.com/admin/startups",
        },
      });
    } catch (err) {
      console.error("Failed to enqueue startup submission notification", err);
    }

    return { ok: true };
  });

// ---------------- Generate startup profile draft ----------------

interface StartupDraft {
  title: string;
  dek: string;
  body_html: string;
  tags: string[];
  seo_title: string;
  meta_description: string;
}

const STARTUP_SYSTEM_PROMPT =
  "You are the AI drafting agent for Cognarah, an African-first AI media publication based in Lagos, Nigeria. Tagline: 'Everything AI. Nothing Else.'\n\n" +
  "VOICE\n" +
  "- Smart, informed journalist. Confident but not arrogant. Clear but not simplistic.\n" +
  "- No hype, no superlatives, no buzzword stacking. Avoid 'groundbreaking', 'revolutionary', 'game-changing'.\n" +
  "- Active voice. Short sentences. One idea per paragraph.\n" +
  "- Never use em dashes anywhere. Use commas, periods, or semicolons instead. If an em dash appears, replace it before returning.\n\n" +
  "TASK: Write a startup profile article using ONLY the submitted facts. Do not invent users, revenue, funding, investors, partnerships, or quotes. If a field is missing, omit that detail rather than guessing.\n\n" +
  "STRUCTURE (every section required, in this order, rendered as clean HTML):\n" +
  "1. Headline: '[Company name] is [one line description of what they do]'. Max 15 words.\n" +
  "2. Opening paragraph: who they are, what they build, where they are based.\n" +
  "3. <h2>The Problem</h2>: the gap or challenge they are addressing.\n" +
  "4. <h2>The Solution</h2>: how the product works and what AI technology powers it.\n" +
  "5. <h2>The Team</h2>: who is behind it and their background (use only what is provided).\n" +
  "6. <h2>Traction</h2>: users, revenue stage, funding, partnerships (only what is provided).\n" +
  "7. <h2>Africa Angle</h2>: if the startup is African (based on country provided), lead with local context and impact. If not African, connect the product or technology to African market opportunities or challenges.\n" +
  "8. Closing line: one forward-looking sentence about what to watch.\n\n" +
  "LENGTH: 500-800 words.\n\n" +
  "HTML RULES: Use only <p>, <h2>, <ul>, <ol>, <li>, <strong>, <em>, <a>. No <h1>. End the body with: <p><em>Source:</em> <a href=\"WEBSITE_URL\">Company name</a></p>.\n\n" +
  "OUTPUT: Return ONLY strict JSON, no markdown, no code fences: " +
  '{"title":"...","dek":"...","body_html":"<p>...</p>...","tags":["...","..."],"seo_title":"...","meta_description":"..."}';

const AFRICAN_COUNTRIES = new Set([
  "nigeria","kenya","south africa","ghana","egypt","morocco","tunisia","algeria","ethiopia","uganda","tanzania","rwanda","senegal","ivory coast","cote d'ivoire","cameroon","zambia","zimbabwe","botswana","namibia","angola","mozambique","sudan","somalia","libya","mali","benin","togo","burkina faso","niger","chad","gabon","congo","dr congo","democratic republic of the congo","republic of the congo","sierra leone","liberia","guinea","mauritania","mauritius","madagascar","malawi","eritrea","djibouti","south sudan","lesotho","swaziland","eswatini","cape verde","gambia","central african republic","equatorial guinea","seychelles","comoros","burundi","sao tome and principe",
]);

function buildStartupUserPrompt(s: Record<string, unknown>): string {
  const isAfrican = AFRICAN_COUNTRIES.has(String(s.country || "").trim().toLowerCase());
  const lines = [
    `Company name: ${s.company_name}`,
    `Website: ${s.website_url}`,
    `Headquarters: ${s.city}, ${s.country}${isAfrican ? " (African startup — lead Africa Angle with local context)" : " (non-African startup — connect to African market opportunities)"}`,
    `Year founded: ${s.year_founded}`,
    `Company stage: ${s.company_stage}`,
    `Product: ${s.product_description}`,
    `Problem solved: ${s.problem_solved}`,
    `Target audience: ${s.target_audience}`,
    `AI technology used: ${Array.isArray(s.ai_technologies) ? (s.ai_technologies as string[]).join(", ") : ""}`,
    `Founder: ${s.founder_name}${s.founder_linkedin ? ` (LinkedIn: ${s.founder_linkedin})` : ""}`,
    `Team size: ${s.team_size}`,
    `Users / customers: ${s.user_count || "not disclosed"}`,
    `Revenue stage: ${s.revenue_stage}`,
    `Funding raised: ${s.funding_raised || "not disclosed"}`,
    `Notable investors: ${s.notable_investors || "not disclosed"}`,
    `Partnerships / clients: ${s.partnerships || "not disclosed"}`,
    `Press coverage: ${s.press_links || "none provided"}`,
  ];
  return `Write the startup profile using ONLY these submitted facts:\n\n${lines.join("\n")}\n\nReturn strict JSON per the schema. End the body with the Source footer linking to ${s.website_url}.`;
}

async function geminiDraftStartup(s: Record<string, unknown>): Promise<StartupDraft> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: STARTUP_SYSTEM_PROMPT },
        { role: "user", content: buildStartupUserPrompt(s) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as StartupDraft;
}

async function claudeRefineStartup(draft: StartupDraft, websiteUrl: string): Promise<StartupDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: STARTUP_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content:
            "Refine this startup profile draft for tone, structure, and flow. Do NOT change facts, quotes, links, or the Source footer. " +
            "Do not add users, revenue, funding, investors, or partnerships that are not already present. Keep the same JSON schema. Return ONLY strict JSON, no code fences.\n\n" +
            `Website (must remain in the Source footer): ${websiteUrl}\n\nDRAFT JSON:\n${JSON.stringify(draft)}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const text: string = Array.isArray(json?.content)
      ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
      : "";
    if (!text) return null;
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as StartupDraft;
    if (!parsed.title || !parsed.body_html) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeDraft(d: StartupDraft): StartupDraft {
  return {
    title: stripEmDashes(d.title || ""),
    dek: stripEmDashes(d.dek || ""),
    body_html: stripEmDashes(d.body_html || ""),
    tags: Array.isArray(d.tags) ? d.tags.map((t) => stripEmDashes(String(t))).slice(0, 8) : [],
    seo_title: stripEmDashes(d.seo_title || ""),
    meta_description: stripEmDashes(d.meta_description || ""),
  };
}

export const generateStartupDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ submission_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Verify admin/editor
    const { data: allowed, error: roleErr } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId,
      _roles: ["admin", "editor"],
    });
    if (roleErr || !allowed) throw new Error("Forbidden");

    const { data: sub, error: subErr } = await context.supabase
      .from("startup_submissions")
      .select("*")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Submission not found");
    if (sub.status !== "approved") throw new Error("Submission must be approved before generating a draft");
    if (sub.article_id) throw new Error("Draft already generated for this submission");

    // Stage 1: Gemini
    const rough = await geminiDraftStartup(sub);
    // Stage 2: Claude (falls back to Gemini on failure)
    const refined = await claudeRefineStartup(rough, String(sub.website_url));
    const draft = sanitizeDraft(refined ?? rough);

    // Resolve category and AI author
    const [{ data: cats }, { data: authorRow }] = await Promise.all([
      context.supabase.from("categories").select("id,slug").in("slug", ["startups", "funding", "news"]),
      context.supabase.from("authors").select("id").eq("slug", "cognarah-ai").maybeSingle(),
    ]);
    const catBySlug = new Map<string, { id: string }>((cats ?? []).map((c: any) => [c.slug, { id: c.id }]));
    const category = catBySlug.get("startups") ?? catBySlug.get("funding") ?? catBySlug.get("news");

    const slug =
      slugify(`${sub.company_name} ${draft.title}`, { lower: true, strict: true }).slice(0, 110) +
      "-" +
      Date.now().toString(36);

    const { data: inserted, error: insErr } = await context.supabase
      .from("articles")
      .insert({
        title: draft.title.slice(0, 200),
        slug,
        excerpt: draft.dek?.slice(0, 300) ?? null,
        body: draft.body_html,
        hero_image: sub.logo_url,
        author_id: authorRow?.id ?? null,
        author_user_id: context.userId,
        category_id: category?.id ?? null,
        tags: draft.tags,
        seo_title: draft.seo_title?.slice(0, 200) ?? null,
        meta_description: draft.meta_description?.slice(0, 300) ?? null,
        read_time: Math.max(2, Math.round((draft.body_html.length / 1000) * 0.7)),
        status: "draft",
        is_featured: false,
        source_urls: [sub.website_url],
      })
      .select("id,slug")
      .single();
    if (insErr) throw new Error(`Draft insert failed: ${insErr.message}`);

    // Update submission
    const { error: updErr } = await context.supabase
      .from("startup_submissions")
      .update({ status: "published", article_id: inserted.id })
      .eq("id", data.submission_id);
    if (updErr) throw new Error(updErr.message);

    return { article_id: inserted.id as string, slug: inserted.slug as string, refined: !!refined };
  });

