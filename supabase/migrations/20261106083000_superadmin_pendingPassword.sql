-- this is for pending accounts without passwords
-- already ran in a separate testing first
-- dependencies: app_user from S1-DBA-03

BEGIN;

ALTER TABLE public.app_user
    ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.app_user
    ADD CONSTRAINT app_user_password_setup_guard
    CHECK (
        password_hash IS NOT NULL
        OR (status = 'Pending' AND is_blocked = TRUE)
    );

COMMIT;
