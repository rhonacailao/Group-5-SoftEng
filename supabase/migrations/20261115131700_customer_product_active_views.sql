-- added the soft-delete support, active views, and indexes for customers and products
-- tested on separate database first
BEGIN;

ALTER TABLE public.customer
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.product
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.active_customers
WITH (security_invoker = true) AS
SELECT custno, custname, address, payterm
FROM public.customer
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.active_products
WITH (security_invoker = true) AS
SELECT prodcode, description, unit
FROM public.product
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customer_active_name_idx
    ON public.customer (lower(custname) text_pattern_ops)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS customer_active_payterm_idx
    ON public.customer (payterm)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_active_description_idx
    ON public.product (lower(description) text_pattern_ops)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_active_unit_idx
    ON public.product (unit)
    WHERE deleted_at IS NULL;

COMMIT;