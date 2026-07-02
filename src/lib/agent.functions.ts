import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ----- shared helpers (all inside handlers to keep client bundle clean) -----

async function requireStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_any_role", {
    _user_id: context.userId,
    _roles: ["admin", "editor"],
  });
  if (error || !data) throw new Error("Forbidden");
}

// ================== SETTINGS ==================
export const getAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("agent_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      enabled: z.boolean(),
      cron_expression: z.string().min(1).max(120),
      default_count: z.number().int().min(1).max(3),
      default_focus: z.string().max(200).nullable().optional(),
      system_prompt: z.string().max(4000).nullable().optional(),
      search_time_window: z.enum(["qdr:h", "qdr:d", "qdr:w", "qdr:m", "qdr:y"]).optional(),
      query_presets: z.array(z.string().min(1).max(200)).max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const update: Record<string, unknown> = {
      enabled: data.enabled,
      cron_expression: data.cron_expression,
      default_count: data.default_count,
      default_focus: data.default_focus ?? null,
      system_prompt: data.system_prompt ?? null,
    };
    if (data.search_time_window) update.search_time_window = data.search_time_window;
    if (data.query_presets) update.query_presets = data.query_presets;
    const { error } = await context.supabase
      .from("agent_settings")
      .update(update)
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ================== SOURCES ==================
export const listAgentSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("agent_sources")
      .select("*")
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addAgentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      label: z.string().min(1).max(120),
      kind: z.enum(["domain", "rss", "url"]),
      value: z.string().min(1).max(300),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("agent_sources").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAgentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("agent_sources").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("agent_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================== RUNS ==================
export const listAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("agent_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ================== RUN THE AGENT ==================
export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      count: z.number().int().min(1).max(3).default(2),
      focus: z.string().max(200).nullable().optional(),
      category_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { runAgentCore } = await import("./agent-core.server");
    return runAgentCore({
      supabase: context.supabase,
      triggeredBy: context.userId,
      trigger: "manual",
      count: data.count,
      focus: data.focus ?? null,
      categoryId: data.category_id ?? null,
    });
  });
