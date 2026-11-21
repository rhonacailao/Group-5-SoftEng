-- accelerate the customer and product ILIKE '%term%' searches with trigram indexes.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;

CREATE INDEX IF NOT EXISTS customer_custno_trgm_idx
    ON public.customer USING gin (custno gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customer_custname_trgm_idx
    ON public.customer USING gin (custname gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customer_address_trgm_idx
    ON public.customer USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_prodcode_trgm_idx
    ON public.product USING gin (prodcode gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_description_trgm_idx
    ON public.product USING gin (description gin_trgm_ops);

COMMIT;
