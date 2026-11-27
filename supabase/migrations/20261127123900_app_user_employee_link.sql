BEGIN;

ALTER TABLE public.app_user
    ADD COLUMN empno VARCHAR(5);

ALTER TABLE public.app_user
    ADD CONSTRAINT app_user_empno_fkey
        FOREIGN KEY (empno)
        REFERENCES public.employee(empno)
        ON DELETE RESTRICT,
    ADD CONSTRAINT app_user_empno_key UNIQUE (empno);

COMMIT;
