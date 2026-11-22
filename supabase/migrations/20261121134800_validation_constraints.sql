-- this sql enforce the allowed payment terms and product units at the database boundary
BEGIN;

ALTER TABLE public.customer
    ALTER COLUMN payterm SET NOT NULL;
ALTER TABLE public.customer
    DROP CONSTRAINT IF EXISTS pay_ck;
ALTER TABLE public.customer
    ADD CONSTRAINT pay_ck CHECK (payterm IN ('COD', '30D', '45D'));

ALTER TABLE public.product
    ALTER COLUMN unit SET NOT NULL;
ALTER TABLE public.product
    DROP CONSTRAINT IF EXISTS unit_ck;
ALTER TABLE public.product
    ADD CONSTRAINT unit_ck CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'));

COMMIT;
