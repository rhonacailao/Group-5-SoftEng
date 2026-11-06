-- S1-DEV-03: what login needs on top of 20261105110500_userManagement.sql.
-- Adds NEW things only; the one change to an existing table is dropping NOT NULL on
-- app_user.password_hash (a user registers WITHOUT a password and chooses one later
-- through a one-time emailed link).
--
-- Review before applying: do NOT run `scripts\migrate.cmd apply` or `supabase db push`
-- without the Scrum Master's approval.

BEGIN;
SET LOCAL search_path TO public;

-- 1. Registered users have no password until they use the link ---------------
ALTER TABLE public.app_user ALTER COLUMN password_hash DROP NOT NULL;

-- 2. The three roles the app uses (role_name is what the code compares) ------
INSERT INTO public."role" (role_name, description, stamp) VALUES
    ('superadmin', 'Full access; approves users and designates admins', 'seed'),
    ('admin',      'Manages users; cannot see superadmin accounts',     'seed'),
    ('user',       'Regular user; sees only the modules granted to them', 'seed')
ON CONFLICT (role_name) DO NOTHING;

-- 3. One-time links: set password (first login) and, later, reset password ----
-- Only the SHA-256 hash of the token is stored, never the token itself.
CREATE TABLE public.password_reset_token (
    token_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES public.app_user(user_id) ON DELETE CASCADE,
    token_hash CHAR(64)    NOT NULL UNIQUE,
    purpose    VARCHAR(20) NOT NULL CHECK (purpose IN ('set_password', 'reset_password')),
    expires_at TIMESTAMPTZ NOT NULL,
    is_used    BOOLEAN     NOT NULL DEFAULT FALSE,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_token_user_idx ON public.password_reset_token (user_id);

-- 4. Login sessions (the browser cookie holds the token; we store only its hash)
CREATE TABLE public.user_session (
    token_hash CHAR(64)    NOT NULL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES public.app_user(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX user_session_user_idx ON public.user_session (user_id);

-- 5. Audit log (ADD / EDIT / DELETE / RESTORE) -------------------------------
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

-- 6. Lock the new tables from the Supabase Data API (same as the other tables) -
ALTER TABLE public.password_reset_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_session         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.password_reset_token FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_session         FROM anon, authenticated;
REVOKE ALL ON TABLE public.audit_log            FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.password_reset_token_token_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.audit_log_audit_id_seq            FROM anon, authenticated;

COMMIT;
