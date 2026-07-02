
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS newsletter_api_key;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_grant_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_role() CASCADE;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_article_views(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO anon, authenticated;

DO $$
DECLARE
  v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'AGENT_CRON_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cognarah-agent-daily') THEN
    PERFORM cron.unschedule('cognarah-agent-daily');
  END IF;

  IF v_secret IS NOT NULL THEN
    PERFORM cron.schedule(
      'cognarah-agent-daily',
      '0 7 * * *',
      format($cmd$
        SELECT net.http_post(
          url := 'https://cognarah-ai-launchpad.lovable.app/api/public/hooks/agent-run',
          headers := jsonb_build_object('Content-Type','application/json','Authorization', 'Bearer %s'),
          body := '{"trigger":"scheduled"}'::jsonb
        );
      $cmd$, v_secret)
    );
  END IF;
END $$;
