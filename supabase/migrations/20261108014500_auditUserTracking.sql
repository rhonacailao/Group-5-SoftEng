-- this is audit user tracking, and it requires tables from DBA-02 and DBA-03. It also requires the password_reset_token from DBA-04.
-- please run on a separate testing project first (for the tester only)
-- for the backend dev, you must apply authenticated app.user_id using SET LOCAL or set_config

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_log (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(63) NOT NULL,
    action VARCHAR(7) NOT NULL
        CHECK (action IN ('ADD', 'EDIT', 'DELETE', 'RESTORE')),
    record_key TEXT,
    old_values JSONB,
    new_values JSONB,
    action_by TEXT NOT NULL,
    action_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.audit_log_audit_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_user()
RETURNS TEXT
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.user_id', true), ''),
        NULLIF(current_setting('app.username', true), ''),
        'db:' || session_user::text
    );
$$;

CREATE OR REPLACE FUNCTION public.trg_dba06_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_row JSONB;
    v_key TEXT := '';
    i INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_row := to_jsonb(NEW);
    ELSE
        v_row := to_jsonb(OLD);
    END IF;

    FOR i IN 0..TG_NARGS - 1 LOOP
        IF i > 0 THEN
            v_key := v_key || '|';
        END IF;
        v_key := v_key || COALESCE(v_row ->> TG_ARGV[i], '<null>');
    END LOOP;

    INSERT INTO public.audit_log (table_name, action, record_key, action_by)
    VALUES (
        TG_TABLE_NAME,
        CASE TG_OP
            WHEN 'INSERT' THEN 'ADD'
            WHEN 'UPDATE' THEN 'EDIT'
            WHEN 'DELETE' THEN 'DELETE'
        END,
        v_key,
        public.audit_user()
    );

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_dba06_audit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_dba06_protect_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.audit_log'::regclass
          AND tgname = 'dba06_audit_log_protect_rows'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER dba06_audit_log_protect_rows
        BEFORE UPDATE OR DELETE ON public.audit_log
        FOR EACH ROW EXECUTE FUNCTION public.trg_dba06_protect_audit_log();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.audit_log'::regclass
          AND tgname = 'dba06_audit_log_protect_truncate'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER dba06_audit_log_protect_truncate
        BEFORE TRUNCATE ON public.audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION public.trg_dba06_protect_audit_log();
    END IF;
END $$;

DO $$
DECLARE
    r RECORD;
    v_trigger_name TEXT;
    v_args TEXT;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('customer',             'custno'),
            ('department',           'deptcode'),
            ('employee',             'empno'),
            ('job',                  'jobcode'),
            ('jobhistory',           'empno,jobcode,effdate'),
            ('payment',              'orno'),
            ('pricehist',            'effdate,prodcode'),
            ('product',              'prodcode'),
            ('sales',                'transno'),
            ('salesdetail',          'transno,prodcode'),
            ('app_user',             'user_id'),
            ('role',                 'role_id'),
            ('module',               'module_id'),
            ('rights',               'right_id'),
            ('user_permission',      'user_id,right_id'),
            ('password_reset_token', 'token_id')
        ) AS target(table_name, key_columns)
    LOOP
        IF to_regclass(format('public.%I', r.table_name)) IS NULL THEN
            RAISE EXCEPTION 'DBA-06 prerequisite table missing: %', r.table_name;
        END IF;

        v_trigger_name := 'dba06_' || r.table_name || '_audit';
        SELECT string_agg(quote_literal(k), ', ' ORDER BY ord)
          INTO v_args
          FROM unnest(string_to_array(r.key_columns, ','))
               WITH ORDINALITY AS p(k, ord);

        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgrelid = format('public.%I', r.table_name)::regclass
              AND tgname = v_trigger_name
              AND NOT tgisinternal
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
                || 'FOR EACH ROW EXECUTE FUNCTION public.trg_dba06_audit(%s)',
                v_trigger_name, r.table_name, v_args
            );
        END IF;
    END LOOP;
END $$;

DO $$
DECLARE
    v_missing TEXT;
    v_protection_count INTEGER;
BEGIN
    SELECT string_agg(e.table_name, ', ' ORDER BY e.table_name)
    INTO v_missing
    FROM (VALUES
        ('customer'), ('department'), ('employee'), ('job'), ('jobhistory'),
        ('payment'), ('pricehist'), ('product'), ('sales'), ('salesdetail'),
        ('app_user'), ('role'), ('module'), ('rights'),
        ('user_permission'), ('password_reset_token')
    ) AS e(table_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = e.table_name
          AND t.tgname = 'dba06_' || e.table_name || '_audit'
          AND t.tgfoid = 'public.trg_dba06_audit()'::regprocedure
          AND NOT t.tgisinternal
          AND t.tgenabled IN ('O','A')
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'DBA-06 missing enabled audit triggers for: %', v_missing;
    END IF;

    SELECT count(*) INTO v_protection_count
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.audit_log'::regclass
      AND t.tgname IN (
          'dba06_audit_log_protect_rows',
          'dba06_audit_log_protect_truncate'
      )
      AND NOT t.tgisinternal
      AND t.tgenabled IN ('O','A');

    IF v_protection_count <> 2 THEN
        RAISE EXCEPTION 'DBA-06 expects 2 audit-log protection triggers, found %', v_protection_count;
    END IF;

    IF NOT (SELECT c.relrowsecurity
            FROM pg_class c
            WHERE c.oid = 'public.audit_log'::regclass) THEN
        RAISE EXCEPTION 'DBA-06 audit_log RLS is not enabled';
    END IF;
END $$;

COMMIT;
