-- Recreate cognarah-agent-daily cron job on the new Supabase project (bgybhqjnzjpzzqinkfkm).
-- Same shape as the original (20260702100929_5e872560-e541-4391-b928-1c23eb40ccd5.sql), with:
--   1. URL updated from the old Lovable-hosted app to the live custom domain.
--   2. AGENT_CRON_SECRET is confirmed present in vault.decrypted_secrets on this project
--      (created 2026-08-31), so this version fails loudly (RAISE EXCEPTION) if it's somehow
--      missing when this runs, instead of silently skipping the schedule the way the
--      original did when the secret wasn't there yet at migration time.
DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'AGENT_CRON_SECRET' LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'AGENT_CRON_SECRET not found in vault.decrypted_secrets — cannot schedule cognarah-agent-daily';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cognarah-agent-daily') THEN
    PERFORM cron.unschedule('cognarah-agent-daily');
  END IF;

  PERFORM cron.schedule(
    'cognarah-agent-daily',
    '0 7 * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://cognarah.com/api/public/hooks/agent-run',
        headers := jsonb_build_object('Content-Type','application/json','Authorization', 'Bearer %s'),
        body := '{"trigger":"scheduled"}'::jsonb
      );
    $cmd$, v_secret)
  );
END $$;
