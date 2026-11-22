--prevent customer and product deletion while dependent records exist
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_customer_delete_with_sales()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    child_count INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT COUNT(*) INTO child_count
    FROM public.sales
    WHERE custno = OLD.custno;

    IF child_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete customer %: % active sales record(s) still exist.',
            OLD.custno, child_count
            USING ERRCODE = '23503',
                  HINT = 'Remove or reassign the dependent sales records first.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS customer_delete_guard ON public.customer;
CREATE TRIGGER customer_delete_guard
BEFORE DELETE OR UPDATE OF deleted_at ON public.customer
FOR EACH ROW
EXECUTE FUNCTION public.prevent_customer_delete_with_sales();

CREATE OR REPLACE FUNCTION public.prevent_product_delete_with_children()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    sales_count INTEGER;
    price_count INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT COUNT(*) INTO sales_count
    FROM public.salesdetail
    WHERE prodcode = OLD.prodcode;

    SELECT COUNT(*) INTO price_count
    FROM public.pricehist
    WHERE prodcode = OLD.prodcode;

    IF sales_count > 0 OR price_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete product %: % sales detail and % price history record(s) still exist.',
            OLD.prodcode, sales_count, price_count
            USING ERRCODE = '23503',
                  HINT = 'Remove or reassign the dependent sales and price history records first.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS product_delete_guard ON public.product;
CREATE TRIGGER product_delete_guard
BEFORE DELETE OR UPDATE OF deleted_at ON public.product
FOR EACH ROW
EXECUTE FUNCTION public.prevent_product_delete_with_children();

COMMIT;
