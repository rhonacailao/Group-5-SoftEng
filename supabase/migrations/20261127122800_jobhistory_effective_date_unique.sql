BEGIN;

ALTER TABLE public.jobhistory
    ADD CONSTRAINT jobhistory_empno_effdate_key UNIQUE (empno, effdate);

COMMIT;
