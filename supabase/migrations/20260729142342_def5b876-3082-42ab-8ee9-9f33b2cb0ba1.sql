ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

UPDATE public.agent_runs
  SET last_heartbeat_at = started_at
  WHERE last_heartbeat_at IS NULL;

UPDATE public.agent_runs
  SET status = 'error',
      error = COALESCE(error, 'stalled: dispatch never reached hook (pre-fix)'),
      finished_at = COALESCE(finished_at, now())
  WHERE status = 'running'
    AND started_at < now() - interval '10 minutes';