-- Recreate the process-email-queue cron job on the new Supabase project
-- (bgybhqjnzjpzzqinkfkm), same underlying gap as cognarah-agent-daily
-- (20260902120000_recreate_cognarah_agent_daily_cron_job.sql): the original
-- setup (see the POST-MIGRATION STEPS comment at the bottom of
-- 20260706182926_email_infra.sql) was applied dynamically by a Lovable-
-- specific tool against the OLD Supabase project, not as tracked SQL, so it
-- never carried over to this project during the self-migration. Nothing was
-- ever calling /lovable/email/queue/process, so every transactional email
-- enqueued since (startup submissions, skills-auto-published, article-auto-
-- published) sat in email_send_log as "pending" indefinitely rather than
-- actually being sent via Resend.
--
-- Same shape as the original design, retargeted at this app's own route
-- instead of the old Lovable Edge Function:
--   1. URL is the live TanStack Start route (src/routes/lovable/email/queue/process.ts),
--      which itself replaced the original Supabase Edge Function during the
--      Lovable migration.
--   2. Auth: this route (unlike agent-run, which uses AGENT_CRON_SECRET)
--      expects the Supabase service role key itself as the Bearer token —
--      that's how it was originally designed ("the pg_cron job sends the
--      service role key as a Bearer token", see process.ts). Stored in
--      vault as 'email_queue_service_role_key', matching the original
--      migration's own documented secret name.
--   3. Interval: 5 seconds, matching the original design (pg_cron supports
--      a plain interval string in place of 5-field cron syntax for sub-
--      minute schedules). Lightweight route (drains a small batch from
--      pgmq), not a heavy multi-step pipeline like the news agent, so
--      request volume at this frequency isn't a subrequest/CPU concern the
--      way the agent's own limits.subrequests issue was.
-- Fails loudly instead of silently skipping if the vault secret isn't there.
DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'email_queue_service_role_key not found in vault.decrypted_secrets — cannot schedule process-email-queue';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;

  PERFORM cron.schedule(
    'process-email-queue',
    '5 seconds',
    format($cmd$
      SELECT net.http_post(
        url := 'https://cognarah.com/lovable/email/queue/process',
        headers := jsonb_build_object('Content-Type','application/json','Authorization', 'Bearer %s'),
        body := '{}'::jsonb
      );
    $cmd$, v_secret)
  );
END $$;
