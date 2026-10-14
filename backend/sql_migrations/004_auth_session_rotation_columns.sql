-- Add the fields required for refresh-token rotation to databases that
-- already have the earlier, minimal user_sessions table.
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS session_family_id UUID,
  ADD COLUMN IF NOT EXISTS replaced_by_session_id UUID;

-- Preserve existing session rows while assigning each legacy row its own family.
UPDATE public.user_sessions
SET session_family_id = gen_random_uuid()
WHERE session_family_id IS NULL;

ALTER TABLE public.user_sessions
  ALTER COLUMN session_family_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_sessions_replaced_by_session_id_fkey'
      AND conrelid = 'public.user_sessions'::regclass
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT user_sessions_replaced_by_session_id_fkey
      FOREIGN KEY (replaced_by_session_id)
      REFERENCES public.user_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id
  ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_user_sessions_family_id
  ON public.user_sessions(session_family_id);
CREATE INDEX IF NOT EXISTS ix_user_sessions_replaced_by
  ON public.user_sessions(replaced_by_session_id);
