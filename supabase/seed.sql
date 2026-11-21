-- this is for demo - small and repeatable demo dataset for customer, product, and price-history screens.
BEGIN;

INSERT INTO public.customer (custno, custname, address, payterm)
VALUES
    ('C9001', 'Northwind Demo LLC', '100 Demo Way, Seattle WA', '30D'),
    ('C9002', 'Maple Test Supply', '25 Sample Street, Portland OR', 'COD'),
    ('C9003', 'Cedar Sample Works', '8 Example Road, Boise ID', '45D')
ON CONFLICT (custno) DO NOTHING;

INSERT INTO public.product (prodcode, description, unit)
VALUES
    ('DM9001', 'Demo Laptop 14-inch', 'ea'),
    ('DM9002', 'Demo Office Chair', 'pc'),
    ('DM9003', 'Demo Cable 2m', 'mtr')
ON CONFLICT (prodcode) DO NOTHING;

INSERT INTO public.pricehist (effdate, prodcode, unitprice)
VALUES
    ('2025-01-01', 'DM9001', 899.99),
    ('2025-06-01', 'DM9001', 849.99),
    ('2025-01-01', 'DM9002', 159.00),
    ('2025-06-01', 'DM9002', 149.00),
    ('2025-01-01', 'DM9003', 12.50),
    ('2025-06-01', 'DM9003', 10.99)
ON CONFLICT (effdate, prodcode) DO NOTHING;

COMMIT;
