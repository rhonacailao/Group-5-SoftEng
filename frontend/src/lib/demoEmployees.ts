import { ApiError } from "./api";
import {
  demoDepartments,
  demoJobs,
  SEED_STAMP,
  stamp,
  type DemoStore,
  type LookupListArgs,
  type LookupRow,
  type LookupTab,
  type LookupValues,
} from "./demoHumanResources";

// Sample employees and their job history for the offline demo account (see authStore.ts). The
// rows are the employee and jobHistory tables of HopeDB_audit.sql. The demo has no server
// session, so the Employees tab reads and writes these in-memory lists instead of calling
// /api/employees and /api/employees/:empNo/job-history. Both stores have the same DemoStore
// shape as jobs and departments, so LookupPanel runs on them unchanged.
//
// Like the real database (trg_check_children), an employee that still has active job history
// cannot be deleted: delete the history rows first. Every change writes a stamp in the same
// format as the database ("EDIT demo 2026-10-12 11:18 AM"). One employee and her job history
// row are seeded as deleted, so the Inactive tab and Restore have something to show.
// Changes live in this browser tab only and are gone after a refresh.

type Status = "Active" | "Inactive";

/** `code` is the employee number (empNo). sepDate is "" while the person is still employed. */
export type DemoEmployee = LookupRow & {
  lastName: string;
  firstName: string;
  gender: "M" | "F";
  birthDate: string; // YYYY-MM-DD
  hireDate: string;
  sepDate: string;
};

/** `code` is "<jobCode>|<effDate>": the key of the row inside one employee (the empNo is in the URL). */
export type DemoHistoryRow = LookupRow & {
  jobCode: string;
  jobDesc: string;
  deptCode: string;
  deptName: string;
  effDate: string; // YYYY-MM-DD
  salary: number;
};

// employee.lastname and employee.firstname are VARCHAR(15)
export const NAME_MAX = 15;

const DELETED_STAMP = "DELETE user2 2026-10-13 01:01 PM"; // as in the mock-up

// [empNo, lastName, firstName, gender, birthDate, hireDate, sepDate]
const EMPLOYEE_SEED: [
  string,
  string,
  string,
  "M" | "F",
  string,
  string,
  string | null,
][] = [
  ["00001", "Smith", "John", "M", "1985-02-20", "2010-05-11", null],
  ["00003", "Smith", "Jane", "F", "1990-05-16", "2010-05-11", null],
  ["00005", "King", "Don", "M", "1986-02-14", "2010-06-23", null],
  ["00007", "Jenskin", "Floyd", "M", "1990-02-20", "2010-05-30", null],
  ["00009", "Cerudo", "Bambie", "F", "1983-06-23", "2010-05-30", null],
  ["00011", "Davis", "Tom", "M", "1989-12-16", "2010-06-30", null],
  ["00013", "Morris", "Olive", "F", "1991-07-21", "2010-06-30", null],
  ["00015", "Zulueta", "Maggie", "F", "1990-08-03", "2010-07-05", "2011-03-30"],
  ["00017", "Celestino", "Nelia", "F", "1984-10-24", "2010-07-05", null],
  [
    "00019",
    "Esperanza",
    "Nehemiah",
    "M",
    "1982-02-21",
    "2010-07-05",
    "2014-04-28",
  ],
  ["00021", "Manchester", "Chelie", "F", "1988-12-07", "2010-07-05", null],
  ["00023", "Kline", "Nicholas", "M", "1992-01-21", "2010-07-05", "2010-12-23"],
  ["00025", "Macapagal", "Ivy", "F", "1992-04-30", "2010-07-05", null],
  ["00027", "Blanche", "Ernest", "M", "1986-12-21", "2010-07-05", null],
  ["00029", "Chua", "Evangeline", "F", "1989-03-10", "2010-07-05", null],
  ["00031", "Lancaster", "Greta", "F", "1987-08-17", "2010-07-05", null],
  ["00033", "Parks", "Nigel", "M", "1993-06-23", "2010-07-05", null],
  ["00035", "Carlston", "Voltaire", "F", "1985-06-12", "2010-07-21", null],
  ["00037", "Silva", "Yves", "M", "1988-09-21", "2010-07-21", null],
  ["00039", "Geisert", "William", "M", "1980-03-03", "2010-07-21", null],
  ["00041", "Darwin", "Helena", "F", "1978-11-08", "2010-09-01", null],
  ["00043", "Love", "Queen", "F", "1983-11-29", "2010-09-01", null],
  ["00045", "Raven", "Danny", "M", "1984-02-15", "2010-12-03", null],
  ["00047", "Devito", "Clint", "M", "1981-06-07", "2010-12-03", null],
  ["00049", "Irving", "Nancy", "F", "1987-09-19", "2010-12-03", null],
  ["00051", "Baltimore", "Fergie", "F", "1986-10-10", "2011-01-05", null],
  ["00053", "Jones", "Veronica", "F", "1983-05-01", "2011-01-05", "2011-03-30"],
  ["00055", "Travis", "Ursula", "F", "1987-06-07", "2011-01-05", null],
  ["00057", "Orleans", "Sylvia", "F", "1987-01-28", "2011-01-05", null],
  ["00059", "Sy", "Alice", "F", "1984-08-13", "2011-01-05", "2011-04-20"],
  ["00061", "De Leon", "Girlie", "F", "1983-07-27", "2011-01-05", null],
  ["00063", "Grant", "Albert", "M", "1979-05-05", "2011-01-05", null],
];

// [empNo, jobCode, effDate, salary, deptCode]
const HISTORY_SEED: [string, string, string, number, string][] = [
  ["00001", "PR1", "2010-05-11", 48000, "IT"],
  ["00001", "PR2", "2010-12-01", 50000, "IT"],
  ["00003", "PR2", "2010-05-11", 50000, "IT"],
  ["00003", "ANYS", "2010-12-01", 55000, "IT"],
  ["00005", "SA1", "2010-06-23", 36000, "BR1"],
  ["00005", "SA2", "2011-01-02", 38000, "BR1"],
  ["00007", "ANYS", "2010-05-30", 55000, "IT"],
  ["00007", "MGR", "2011-01-02", 60000, "IT"],
  ["00007", "VP", "2011-03-31", 80000, "IT"],
  ["00009", "ACCT", "2010-05-30", 50000, "ACT"],
  ["00009", "MGR", "2010-12-01", 60000, "ACT"],
  ["00011", "PRES", "2010-06-30", 100000, "EXC"],
  ["00013", "MGR", "2010-06-30", 60000, "BR1"],
  ["00013", "VP", "2011-01-02", 80000, "BR2"],
  ["00013", "VP", "2011-03-01", 80000, "BR1"],
  ["00015", "SA1", "2010-07-05", 36000, "BR1"],
  ["00017", "SA1", "2010-07-05", 36000, "BR1"],
  ["00017", "SPVR", "2011-01-12", 40000, "BR1"],
  ["00019", "SA1", "2010-07-05", 36000, "BR1"],
  ["00019", "SA2", "2011-01-12", 38000, "BR1"],
  ["00021", "SA1", "2010-07-05", 36000, "BR1"],
  ["00021", "SA2", "2011-01-12", 38000, "BR1"],
  ["00023", "MGR", "2010-07-05", 60000, "HRD"],
  ["00025", "SA1", "2010-07-05", 36000, "BR1"],
  ["00027", "SA1", "2010-07-05", 36000, "BR1"],
  ["00027", "SA2", "2011-01-12", 38000, "BR1"],
  ["00029", "SPVR", "2010-07-05", 40000, "BR1"],
  ["00029", "MGR", "2011-01-02", 60000, "BR1"],
  ["00031", "WMAN", "2010-07-05", 35000, "WHS"],
  ["00031", "WMAN", "2011-12-01", 40000, "WHS"],
  ["00033", "WMAN", "2010-07-05", 35000, "WHS"],
  ["00035", "ACCT", "2010-07-21", 50000, "PAY"],
  ["00037", "CLK1", "2010-07-21", 34000, "PAY"],
  ["00039", "CLK1", "2010-07-21", 34000, "PAY"],
  ["00039", "CLK2", "2012-06-30", 35000, "EXC"],
  ["00041", "SPVR", "2010-09-01", 40000, "WHS"],
  ["00041", "MGR", "2011-06-01", 60000, "WHS"],
  ["00043", "CLK2", "2010-09-01", 35000, "EXC"],
  ["00043", "SPVR", "2011-06-01", 35000, "EXC"],
  ["00043", "SPVR", "2011-01-12", 35000, "HRD"],
  ["00045", "SPVR", "2010-12-03", 40000, "ACT"],
  ["00047", "CLK1", "2010-12-03", 34000, "EXC"],
  ["00047", "CLK2", "2011-01-12", 35000, "HRD"],
  ["00049", "MGR", "2010-12-03", 60000, "BR2"],
  ["00051", "SA1", "2011-01-05", 36000, "BR2"],
  ["00053", "SA1", "2011-01-05", 36000, "BR2"],
  ["00055", "SA1", "2011-01-05", 36000, "BR2"],
  ["00055", "SA2", "2011-03-01", 38000, "BR2"],
  ["00057", "SA1", "2011-01-05", 36000, "BR2"],
  ["00057", "PR1", "2011-06-01", 48000, "BR2"],
  ["00059", "SA1", "2011-01-05", 36000, "BR2"],
  ["00061", "SA1", "2011-01-05", 36000, "BR2"],
  ["00063", "SA2", "2011-01-05", 38000, "BR2"],
  ["00063", "SPVR", "2011-06-01", 40000, "BR2"],
];
// ---------- helpers ----------
const isDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const fail = (errors: Record<string, string>) => {
  if (Object.keys(errors).length > 0)
    throw new ApiError("Please check the form.", 400, undefined, errors);
};

const readName = (
  raw: string | undefined,
  label: string,
  key: string,
  errors: Record<string, string>,
) => {
  const value = (raw ?? "").trim();
  if (!value) errors[key] = `${label} is required.`;
  else if (Array.from(value).length > NAME_MAX)
    errors[key] = `${label} can be at most ${NAME_MAX} characters.`;
  return value;
};

const statusOf = (tab: LookupTab): Status | null =>
  tab === "all" ? null : tab === "active" ? "Active" : "Inactive";

const countBy = (rows: { status: Status }[]) => ({
  active: rows.filter((r) => r.status === "Active").length,
  inactive: rows.filter((r) => r.status === "Inactive").length,
  all: rows.length,
});

// ---------- employees ----------
let employees: DemoEmployee[] = EMPLOYEE_SEED.map(
  ([code, lastName, firstName, gender, birthDate, hireDate, sepDate]) => ({
    code,
    lastName,
    firstName,
    gender,
    birthDate,
    hireDate,
    sepDate: sepDate ?? "",
    status: "Active" as Status,
    stamp: SEED_STAMP,
  }),
);

type HistoryRecord = {
  empNo: string;
  jobCode: string;
  deptCode: string;
  effDate: string;
  salary: number;
  status: Status;
  stamp: string;
};
let history: HistoryRecord[] = HISTORY_SEED.map(
  ([empNo, jobCode, effDate, salary, deptCode]) => ({
    empNo,
    jobCode,
    deptCode,
    effDate,
    salary,
    status: "Active" as Status,
    stamp: SEED_STAMP,
  }),
);

// Alice Sy (00059) left on 2011-04-20 and has one job history row: both are deleted
for (const e of employees)
  if (e.code === "00059") {
    e.status = "Inactive";
    e.stamp = DELETED_STAMP;
  }
for (const h of history)
  if (h.empNo === "00059") {
    h.status = "Inactive";
    h.stamp = DELETED_STAMP;
  }

const findEmployee = (code: string) => {
  const row = employees.find((e) => e.code === code);
  if (!row) throw new ApiError("Employee not found", 404);
  return row;
};

const readEmployee = (input: LookupValues) => {
  const errors: Record<string, string> = {};
  const lastName = readName(input.lastName, "Last name", "lastName", errors);
  const firstName = readName(
    input.firstName,
    "First name",
    "firstName",
    errors,
  );
  const gender = (input.gender ?? "").trim().toUpperCase();
  if (gender !== "M" && gender !== "F")
    errors.gender = "Gender must be M or F.";
  const birthDate = (input.birthDate ?? "").trim();
  const hireDate = (input.hireDate ?? "").trim();
  const sepDate = (input.sepDate ?? "").trim();
  if (!birthDate) errors.birthDate = "Birth date is required.";
  else if (!isDate(birthDate))
    errors.birthDate = "Birth date is not a valid date.";
  if (!hireDate) errors.hireDate = "Hire date is required.";
  else if (!isDate(hireDate))
    errors.hireDate = "Hire date is not a valid date.";
  else if (isDate(birthDate) && hireDate <= birthDate)
    errors.hireDate = "Hire date must be after the birth date.";
  if (sepDate) {
    if (!isDate(sepDate))
      errors.sepDate = "Separation date is not a valid date.";
    else if (isDate(hireDate) && sepDate < hireDate)
      errors.sepDate = "Separation date cannot be before the hire date.";
  }
  fail(errors);
  return {
    lastName,
    firstName,
    gender: gender as "M" | "F",
    birthDate,
    hireDate,
    sepDate,
  };
};

/** Next employee number, five digits like the database. The sample numbers step by 2 (00001, 00003...). */
const nextEmployeeNo = () => {
  const max = employees.reduce((m, e) => Math.max(m, Number(e.code)), 0);
  return String(max + 2).padStart(5, "0");
};

/** GET/POST/PATCH/DELETE /api/employees (soft delete) */
export const demoEmployees: DemoStore = {
  list({ tab, query, page, pageSize }: LookupListArgs) {
    const term = query.trim().toLowerCase();
    const matches = employees.filter(
      (e) =>
        !term ||
        [e.code, e.lastName, e.firstName, `${e.firstName} ${e.lastName}`].some(
          (v) => v.toLowerCase().includes(term),
        ),
    );
    const wanted = statusOf(tab);
    const shown = matches
      .filter((e) => !wanted || e.status === wanted)
      .sort((a, b) => a.code.localeCompare(b.code));
    const start = (page - 1) * pageSize;
    return {
      ok: true as const,
      items: shown.slice(start, start + pageSize).map((e) => ({ ...e })),
      total: shown.length,
      counts: countBy(matches),
      page,
      pageSize,
    };
  },

  nextCode: nextEmployeeNo,

  create(input) {
    const values = readEmployee(input);
    const row: DemoEmployee = {
      code: nextEmployeeNo(),
      ...values,
      status: "Active",
      stamp: stamp("ADD"),
    };
    employees = [...employees, row];
    return row;
  },

  // The employee number never changes
  update(code, input) {
    const values = readEmployee(input);
    const current = findEmployee(code);
    if (current.status === "Inactive")
      throw new ApiError(
        "This employee was deleted. Restore it before editing.",
        409,
      );
    const changed = (Object.keys(values) as (keyof typeof values)[]).some(
      (k) => current[k] !== values[k],
    );
    // Like the stamp trigger: nothing changed, so the stamp stays as it was
    if (changed) {
      Object.assign(current, values);
      current.stamp = stamp("EDIT");
    }
    employees = [...employees];
    return current;
  },

  remove(code) {
    const current = findEmployee(code);
    if (current.status === "Inactive")
      throw new ApiError("This employee is already deleted.", 409);
    const n = history.filter(
      (h) => h.empNo === code && h.status === "Active",
    ).length;
    if (n > 0)
      throw new ApiError(
        `${code} cannot be deleted: it still has ${n} active job history record${n === 1 ? "" : "s"}. Delete them first.`,
        409,
      );
    current.status = "Inactive";
    current.stamp = stamp("DELETE");
    employees = [...employees];
    return current;
  },

  restore(code) {
    const current = findEmployee(code);
    if (current.status === "Active")
      throw new ApiError("This employee is not deleted.", 409);
    current.status = "Active";
    current.stamp = stamp("RESTORE");
    employees = [...employees];
    return current;
  },
};

// ---------- job history ----------
type Option = { value: string; label: string };

/** Active jobs and departments, for the dropdowns of the job history form. */
export function demoHistoryOptions(): {
  jobs: Option[];
  departments: Option[];
} {
  const all = { tab: "active" as const, query: "", page: 1, pageSize: 1000 };
  const toOptions = (rows: LookupRow[]) =>
    rows.map((r) => ({
      value: r.code,
      label: `${r.code} — ${String(r.name)}`,
    }));
  return {
    jobs: toOptions(demoJobs.list(all).items),
    departments: toOptions(demoDepartments.list(all).items),
  };
}

const nameOf = (store: DemoStore, code: string) => {
  const row = store
    .list({ tab: "all", query: "", page: 1, pageSize: 1000 })
    .items.find((r) => r.code === code);
  return row ? String(row.name) : code;
};

const toHistoryRow = (h: HistoryRecord): DemoHistoryRow => ({
  code: `${h.jobCode}|${h.effDate}`,
  jobCode: h.jobCode,
  jobDesc: nameOf(demoJobs, h.jobCode),
  deptCode: h.deptCode,
  deptName: nameOf(demoDepartments, h.deptCode),
  effDate: h.effDate,
  salary: h.salary,
  status: h.status,
  stamp: h.stamp,
});

const splitKey = (code: string) => {
  const [jobCode = "", effDate = ""] = code.split("|");
  return { jobCode, effDate };
};

/** The job history of one employee, as a store: GET/POST/PATCH/DELETE /api/employees/:empNo/job-history */
export function makeJobHistoryStore(empNo: string): DemoStore {
  const find = (code: string) => {
    const { jobCode, effDate } = splitKey(code);
    const row = history.find(
      (h) =>
        h.empNo === empNo && h.jobCode === jobCode && h.effDate === effDate,
    );
    if (!row) throw new ApiError("Job history record not found", 404);
    return row;
  };

  const readDeptAndSalary = (input: LookupValues) => {
    const errors: Record<string, string> = {};
    const deptCode = (input.deptCode ?? "").trim();
    if (!deptCode) errors.deptCode = "Department is required.";
    else if (
      !demoHistoryOptions().departments.some((d) => d.value === deptCode)
    )
      errors.deptCode = "Choose one of the active departments.";
    const salaryText = (input.salary ?? "").trim();
    const salary = Number(salaryText);
    if (!salaryText) errors.salary = "Salary is required.";
    else if (!Number.isFinite(salary) || salary < 0)
      errors.salary = "Salary must be a number, 0 or more.";
    else if (salary >= 100_000_000)
      errors.salary = "Salary is too large (at most 99,999,999.99).";
    return { errors, deptCode, salary: Math.round(salary * 100) / 100 };
  };

  return {
    // Newest first, like the mock-up. A person has few rows, so there is no search or paging.
    list({ tab }) {
      findEmployee(empNo);
      const mine = history.filter((h) => h.empNo === empNo);
      const wanted = statusOf(tab);
      const shown = mine
        .filter((h) => !wanted || h.status === wanted)
        .sort((a, b) => b.effDate.localeCompare(a.effDate))
        .map(toHistoryRow);
      return {
        ok: true as const,
        items: shown,
        total: shown.length,
        counts: countBy(mine),
        page: 1,
        pageSize: shown.length || 1,
      };
    },

    create(input) {
      const employee = findEmployee(empNo);
      if (employee.status === "Inactive")
        throw new ApiError("This employee was deleted. Restore it first.", 409);
      const { errors, deptCode, salary } = readDeptAndSalary(input);
      const jobCode = (input.jobCode ?? "").trim();
      if (!jobCode) errors.jobCode = "Job is required.";
      else if (!demoHistoryOptions().jobs.some((j) => j.value === jobCode))
        errors.jobCode = "Choose one of the active jobs.";
      const effDate = (input.effDate ?? "").trim();
      if (!effDate) errors.effDate = "Effective date is required.";
      else if (!isDate(effDate))
        errors.effDate = "Effective date is not a valid date.";
      else if (effDate < employee.hireDate)
        errors.effDate = "Effective date cannot be before the hire date.";
      fail(errors);
      // Primary key (empNo, jobCode, effDate): a deleted row still holds its key
      if (
        history.some(
          (h) =>
            h.empNo === empNo && h.jobCode === jobCode && h.effDate === effDate,
        )
      ) {
        const message = "This employee already has that job on that date.";
        throw new ApiError(message, 409, undefined, { effDate: message });
      }
      const row: HistoryRecord = {
        empNo,
        jobCode,
        deptCode,
        effDate,
        salary,
        status: "Active",
        stamp: stamp("ADD"),
      };
      history = [...history, row];
      return toHistoryRow(row);
    },

    // The job and the date are the key, so only the department and the salary can change
    update(code, input) {
      const { errors, deptCode, salary } = readDeptAndSalary(input);
      fail(errors);
      const current = find(code);
      if (current.status === "Inactive")
        throw new ApiError(
          "This job history record was deleted. Restore it before editing.",
          409,
        );
      if (current.salary !== salary || current.deptCode !== deptCode) {
        current.salary = salary;
        current.deptCode = deptCode;
        current.stamp = stamp("EDIT");
      }
      history = [...history];
      return toHistoryRow(current);
    },

    // A history row has no children, so it can always be deleted
    remove(code) {
      const current = find(code);
      if (current.status === "Inactive")
        throw new ApiError("This job history record is already deleted.", 409);
      current.status = "Inactive";
      current.stamp = stamp("DELETE");
      history = [...history];
      return toHistoryRow(current);
    },

    restore(code) {
      const current = find(code);
      if (current.status === "Active")
        throw new ApiError("This job history record is not deleted.", 409);
      if (findEmployee(empNo).status === "Inactive")
        throw new ApiError("Restore the employee first.", 409);
      current.status = "Active";
      current.stamp = stamp("RESTORE");
      history = [...history];
      return toHistoryRow(current);
    },
  };
}
