-- S1-DBA-05: Seed role, module, and 36-right catalogue.
-- this is seed role, module, and 36 right catalogue
-- already ran in isolated Supabase testing before review
-- dependencies: public.role, public.module and public.rights from S1-DBA-03
-- doesn't create superadmin acc or passwords since that requires backend things

BEGIN;

INSERT INTO public."role" (role_name, description)
VALUES
    ('Superadmin','Full system administration'),
    ('Admin','Administrative access except Superadmin accounts'),
    ('User','Access based on assigned permissions')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO public.module (module_code, module_name, description)
VALUES
    ('CUSTOMER','Customer','Customer Management'),
    ('PRODUCT','Product','Product and price history management'),
    ('HUMAN_RESOURCES','Human Resources','Employees, jobs, departments, and job histories'),
    ('SALES','Sales','Sales and sale detail management'),
    ('REPORTS','Reports','Business reports')
ON CONFLICT (module_code) DO NOTHING;

WITH catalogue (right_code, module_code, description) AS (
    VALUES
    ('CUSTOMER_ADD','CUSTOMER','Add customer'),
    ('CUSTOMER_EDIT','CUSTOMER','Edit customer'),
    ('CUSTOMER_DELETE','CUSTOMER','Delete customer'),
    ('PRODUCT_ADD','PRODUCT','Add product'),
    ('PRODUCT_EDIT','PRODUCT','Edit product'),
    ('PRODUCT_DELETE','PRODUCT','Delete product'),
    ('PRICE_ADD','PRODUCT','Add price'),
    ('PRICE_EDIT','PRODUCT','Edit price'),
    ('PRICE_DELETE','PRODUCT','Delete price'),
    ('JOB_ADD','HUMAN_RESOURCES','Add job'),
    ('JOB_EDIT','HUMAN_RESOURCES','Edit job'),
    ('JOB_DELETE','HUMAN_RESOURCES','Delete job'),
    ('DEPARTMENT_ADD','HUMAN_RESOURCES','Add department'),
    ('DEPARTMENT_EDIT','HUMAN_RESOURCES','Edit department'),
    ('DEPARTMENT_DELETE','HUMAN_RESOURCES','Delete department'),
    ('EMPLOYEE_ADD','HUMAN_RESOURCES','Add employee'),
    ('EMPLOYEE_EDIT','HUMAN_RESOURCES','Edit employee'),
    ('EMPLOYEE_DELETE','HUMAN_RESOURCES','Delete employee'),
    ('JOB_HISTORY_VIEW','HUMAN_RESOURCES','View job history'),
    ('JOB_HISTORY_ADD','HUMAN_RESOURCES','Add job history'),
    ('JOB_HISTORY_EDIT','HUMAN_RESOURCES','Edit job history'),
    ('JOB_HISTORY_DELETE','HUMAN_RESOURCES','Delete job history'),
    ('SALE_ADD','SALES','Add sale'),
    ('SALE_EDIT','SALES','Edit sale'),
    ('SALE_DELETE','SALES','Delete sale'),
    ('SALE_DETAIL_VIEW','SALES','View sale detail'),
    ('SALE_DETAIL_ADD','SALES','Add sale detail'),
    ('SALE_DETAIL_EDIT','SALES','Edit sale detail'),
    ('SALE_DETAIL_DELETE','SALES','Delete sale detail'),
    ('REPORT_TOP_CUSTOMERS','REPORTS','View Top Customers report'),
    ('REPORT_PRODUCT_MASTER_LIST','REPORTS','View Product Master List report'),
    ('REPORT_TOP_PRODUCTS','REPORTS','View Top Products report'),
    ('REPORT_ACTIVE_EMPLOYEES','REPORTS','View Active Employees report'),
    ('REPORT_ALL_EMPLOYEES','REPORTS','View All Employees report'),
    ('REPORT_EMPLOYEE_JOB_HISTORY','REPORTS','View Employee Job History report'),
    ('REPORT_TOP_SALES','REPORTS','View Top Sales report')
)
INSERT INTO public.rights (right_code, module_id, description)
SELECT c.right_code, m.module_id, c.description
FROM catalogue AS c
JOIN public.module AS m ON m.module_code = c.module_code
ON CONFLICT (right_code) DO NOTHING;

DO $$
DECLARE
    active_role_count INTEGER;
    active_module_count INTEGER;
    active_right_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_role_count FROM public."role"
    WHERE role_name IN ('Superadmin', 'Admin', 'User')
      AND status = 'Active' AND deleted_at IS NULL;
    SELECT COUNT(*) INTO active_module_count FROM public.module
    WHERE module_code IN ('CUSTOMER','PRODUCT','HUMAN_RESOURCES','SALES','REPORTS')
      AND status = 'Active' AND deleted_at IS NULL;
    WITH expected (right_code, module_code) AS (
        VALUES
            ('CUSTOMER_ADD','CUSTOMER'),
            ('CUSTOMER_EDIT','CUSTOMER'),
            ('CUSTOMER_DELETE','CUSTOMER'),
            ('PRODUCT_ADD','PRODUCT'),
            ('PRODUCT_EDIT','PRODUCT'),
            ('PRODUCT_DELETE','PRODUCT'),
            ('PRICE_ADD','PRODUCT'),
            ('PRICE_EDIT','PRODUCT'),
            ('PRICE_DELETE','PRODUCT'),
            ('JOB_ADD','HUMAN_RESOURCES'),
            ('JOB_EDIT','HUMAN_RESOURCES'),
            ('JOB_DELETE','HUMAN_RESOURCES'),
            ('DEPARTMENT_ADD','HUMAN_RESOURCES'),
            ('DEPARTMENT_EDIT','HUMAN_RESOURCES'),
            ('DEPARTMENT_DELETE','HUMAN_RESOURCES'),
            ('EMPLOYEE_ADD','HUMAN_RESOURCES'),
            ('EMPLOYEE_EDIT','HUMAN_RESOURCES'),
            ('EMPLOYEE_DELETE','HUMAN_RESOURCES'),
            ('JOB_HISTORY_VIEW','HUMAN_RESOURCES'),
            ('JOB_HISTORY_ADD','HUMAN_RESOURCES'),
            ('JOB_HISTORY_EDIT','HUMAN_RESOURCES'),
            ('JOB_HISTORY_DELETE','HUMAN_RESOURCES'),
            ('SALE_ADD','SALES'),
            ('SALE_EDIT','SALES'),
            ('SALE_DELETE','SALES'),
            ('SALE_DETAIL_VIEW','SALES'),
            ('SALE_DETAIL_ADD','SALES'),
            ('SALE_DETAIL_EDIT','SALES'),
            ('SALE_DETAIL_DELETE','SALES'),
            ('REPORT_TOP_CUSTOMERS','REPORTS'),
            ('REPORT_PRODUCT_MASTER_LIST','REPORTS'),
            ('REPORT_TOP_PRODUCTS','REPORTS'),
            ('REPORT_ACTIVE_EMPLOYEES','REPORTS'),
            ('REPORT_ALL_EMPLOYEES','REPORTS'),
            ('REPORT_EMPLOYEE_JOB_HISTORY','REPORTS'),
            ('REPORT_TOP_SALES','REPORTS')
    )
    SELECT COUNT(*) INTO active_right_count
    FROM expected e
    JOIN public.rights r ON r.right_code = e.right_code
    JOIN public.module m ON m.module_id = r.module_id
        AND m.module_code = e.module_code
    WHERE r.status = 'Active' AND r.deleted_at IS NULL
      AND m.status = 'Active' AND m.deleted_at IS NULL;
    IF active_role_count <> 3 OR active_module_count <> 5 OR active_right_count <> 36 THEN
        RAISE EXCEPTION 'Incomplete or inactive DBA-05 catalogue: roles %, modules %, rights %',
            active_role_count, active_module_count, active_right_count;
    END IF;
END $$;

COMMIT;
