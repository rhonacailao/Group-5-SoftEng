-- S1-DEV-03: what login needs on top of Karla's migrations (userManagement,
-- password_reset_token, modulesRights, superadmin_pendingPassword).
-- Adds NEW tables only: user_session and audit_log. It does not change her tables.
-- (Roles are seeded by 20261105140000_modulesRights.sql and password-less accounts are
-- allowed by 20261106083000_superadmin_pendingPassword.sql.)
--
-- Review before applying: do NOT run `scripts\migrate.cmd apply` or `supabase db push`
-- without the Scrum Master's approval.

BEGIN;
SET LOCAL search_path TO public;

-- (The one-time-link table is Karla's 20261105130000_password_reset_token.sql.)

-- 1. Login sessions (the browser cookie holds the token; we store only its hash)
CREATE TABLE public.user_session (
    token_hash CHAR(64)    NOT NULL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES public.app_user(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX user_session_user_idx ON public.user_session (user_id);

-- 2. Audit log (ADD / EDIT / DELETE / RESTORE) -------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    audit_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  VARCHAR(30) NOT NULL,
    action      VARCHAR(7)  NOT NULL CHECK (action IN ('ADD','EDIT','DELETE','RESTORE')),
    record_key  VARCHAR(60),
    old_values  JSONB,
    new_values  JSONB,
    action_by   VARCHAR(50) NOT NULL,
    action_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Lock the new tables from the Supabase Data API (same as the other tables) -
ALTER TABLE public.user_session         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_session         FROM anon, authenticated;
REVOKE ALL ON TABLE public.audit_log            FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.audit_log_audit_id_seq            FROM anon, authenticated;

COMMIT;
