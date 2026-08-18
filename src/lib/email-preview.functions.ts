import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdminOrEditor(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "editor" }),
  ]);
  if (!isAdmin && !isEditor) throw new Error("Forbidden: admin or editor role required");
}

export const previewStartupSubmissionEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOrEditor(context.supabase, context.userId);

    const { supabaseAdmin: sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = sa as any;

    const { data: row, error } = await supabaseAdmin
      .from("startup_submissions")
      .select(
        "id, company_name, founder_name, country, city, company_stage, product_description, problem_solved, founder_email, contact_method, whatsapp_number, submitted_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Submission not found");

    const templateData = {
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
      submittedAt: row.submitted_at,
      reviewUrl: "https://cognarah.com/admin/startups",
    };

    const React = await import("react");
    const { render } = await import("@react-email/render");
    const { TEMPLATES } = await import("@/lib/email-templates/registry");

    const entry = TEMPLATES["startup-submission-notification"];
    if (!entry) throw new Error("Template not registered");

    const element = React.createElement(entry.component as any, templateData);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof entry.subject === "function" ? entry.subject(templateData) : entry.subject;

    return {
      subject,
      to: entry.to ?? "info@cognarah.com",
      html,
      text,
      companyName: row.company_name,
    };
  });
