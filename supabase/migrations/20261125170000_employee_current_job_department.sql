BEGIN;
SET LOCAL search_path TO public;

CREATE INDEX IF NOT EXISTS jobhistory_employee_effective_desc_idx
    ON public.jobhistory (empno, effdate DESC, jobcode);

CREATE OR REPLACE VIEW public.current_employee_job_department
WITH (security_invoker = true) AS
WITH latest_job AS (
    SELECT DISTINCT ON (jh.empno)
        jh.empno,
        jh.jobcode,
        jh.effdate,
        jh.salary,
        jh.deptcode
    FROM public.jobhistory AS jh
    WHERE jh.effdate <= CURRENT_DATE
    ORDER BY jh.empno, jh.effdate DESC, jh.jobcode ASC
)
SELECT
    e.empno,
    e.firstname,
    e.lastname,
    lj.jobcode,
    j.jobdesc AS job_title,
    lj.deptcode,
    d.deptname AS department_name,
    lj.effdate AS assignment_effective_date,
    lj.salary
FROM public.employee AS e
JOIN latest_job AS lj ON lj.empno = e.empno
JOIN public.job AS j ON j.jobcode = lj.jobcode
LEFT JOIN public.department AS d ON d.deptcode = lj.deptcode
WHERE e.hiredate <= CURRENT_DATE
  AND (e.sepdate IS NULL OR e.sepdate > CURRENT_DATE);

CREATE OR REPLACE VIEW public.active_employee_job_department
WITH (security_invoker = true) AS
SELECT
    empno,
    firstname,
    lastname,
    jobcode,
    job_title,
    deptcode,
    department_name,
    assignment_effective_date,
    salary
FROM public.current_employee_job_department;

CREATE OR REPLACE FUNCTION public.get_employee_current_job_department(
    p_empno VARCHAR,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    empno VARCHAR,
    firstname VARCHAR,
    lastname VARCHAR,
    jobcode VARCHAR,
    job_title VARCHAR,
    deptcode VARCHAR,
    department_name VARCHAR,
    assignment_effective_date DATE,
    salary DECIMAL
)
LANGUAGE sql
STABLE
AS $$
    WITH latest_job AS (
        SELECT DISTINCT ON (jh.empno)
            jh.empno,
            jh.jobcode,
            jh.effdate,
            jh.salary,
            jh.deptcode
        FROM public.jobhistory AS jh
        WHERE jh.empno = p_empno
          AND jh.effdate <= p_as_of_date
        ORDER BY jh.empno, jh.effdate DESC, jh.jobcode ASC
    )
    SELECT
        e.empno,
        e.firstname,
        e.lastname,
        lj.jobcode,
        j.jobdesc,
        lj.deptcode,
        d.deptname,
        lj.effdate,
        lj.salary
    FROM public.employee AS e
    JOIN latest_job AS lj ON lj.empno = e.empno
    JOIN public.job AS j ON j.jobcode = lj.jobcode
    LEFT JOIN public.department AS d ON d.deptcode = lj.deptcode
    WHERE e.hiredate <= p_as_of_date
      AND (e.sepdate IS NULL OR e.sepdate > p_as_of_date)
$$;

REVOKE ALL ON TABLE public.current_employee_job_department FROM anon, authenticated;
REVOKE ALL ON TABLE public.active_employee_job_department FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_employee_current_job_department(VARCHAR, DATE)
    FROM PUBLIC, anon, authenticated;

COMMIT;
