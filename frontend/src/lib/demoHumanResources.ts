import { ApiError } from "./api";

// Sample jobs and departments for the offline demo account (see authStore.ts). The demo has no
// server session, so HumanResourcesPage reads and writes these in-memory lists instead of calling
// /api/jobs and /api/departments. Employees and their job history are in demoEmployees.ts and
// use the same DemoStore shape.
//
// The rows are the job and department tables of HopeDB_audit.sql, and `history` is how many rows
// of the jobHistory table point at each one. Like the real database (trg_check_children), a job
// or department that still has job history cannot be deleted. Every change also writes a stamp in
// the same format as the database: "EDIT user1 2026-10-12 11:18 AM".
// Changes live in this browser tab only and are gone after a refresh.

export type DemoLookupRow = {
  code: string;
  name: string;
  status: "Active" | "Inactive";
  stamp: string;
};

/**
 * A row of any LookupPanel table. Jobs and departments only add `name`; employees add their
 * own fields (lastName, hireDate...). `code` is the key used in the URL of the row.
 */
export type LookupRow = {
  code: string;
  status: "Active" | "Inactive";
  stamp: string;
  [field: string]: unknown;
};

export type LookupTab = "active" | "inactive" | "all";

export type LookupListArgs = {
  tab: LookupTab;
  query: string;
  page: number;
  pageSize: number;
};

/** Same answer shape as GET /api/jobs, GET /api/departments and GET /api/employees */
export type LookupListResponse = {
  ok: true;
  items: LookupRow[];
  total: number;
  counts: Record<LookupTab, number>;
  page: number;
  pageSize: number;
};

/** What the add / edit form sends: one text per form field, keyed like the field */
export type LookupValues = Record<string, string>;

/** What the panel needs from any store, so it can run on jobs, departments, employees... */
export type DemoStore = {
  list: (args: LookupListArgs) => LookupListResponse;
  create: (input: LookupValues) => LookupRow;
  update: (code: string, input: LookupValues) => LookupRow;
  remove: (code: string) => LookupRow;
  restore: (code: string) => LookupRow;
  /** Only for tables whose key is assigned by the system (employee numbers) */
  nextCode?: () => string;
};

type StoreConfig = {
  /** Lower case, used in messages: "job" -> "This job was deleted." */
  noun: string;
  codeLabel: string;
  nameLabel: string;
  codeMax: number;
  nameMax: number;
  /** Lower case, singular, for the "still has N ..." message */
  childNoun: string;
};

/** The demo user is an admin, so it gets every right. Keys are the tile codes of GET /api/menu. */
export const DEMO_HR_RIGHTS: Record<string, string[]> = {
  EMPLOYEE: ["EMPLOYEE_ADD", "EMPLOYEE_EDIT", "EMPLOYEE_DELETE"],
  JOB: ["JOB_ADD", "JOB_EDIT", "JOB_DELETE"],
  DEPARTMENT: ["DEPARTMENT_ADD", "DEPARTMENT_EDIT", "DEPARTMENT_DELETE"],
};

const DEMO_USER = "demo";
// The database labels the rows loaded by the script with "ADD system <load time>"
export const SEED_STAMP = "ADD system 2026-10-12 09:00 AM";

// Time in Asia/Manila, written like the database does: 2026-10-12 11:18 AM
function nowText() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour24 = Number(get("hour")) % 24;
  const hour12 = String(hour24 % 12 || 12).padStart(2, "0");
  const ampm = hour24 >= 12 ? "PM" : "AM";
  return `${get("year")}-${get("month")}-${get("day")} ${hour12}:${get("minute")} ${ampm}`;
}

export type StampAction = "ADD" | "EDIT" | "DELETE" | "RESTORE";
export const stamp = (action: StampAction) =>
  `${action} ${DEMO_USER} ${nowText()}`;

function createStore(
  config: StoreConfig,
  // [code, name, history]
  seed: [string, string, number][],
): DemoStore {
  let rows: DemoLookupRow[] = seed.map(([code, name]) => ({
    code,
    name,
    status: "Active",
    stamp: SEED_STAMP,
  }));
  const historyCount = new Map<string, number>(
    seed.map(([code, , history]) => [code, history]),
  );

  const find = (code: string) => {
    const row = rows.find((r) => r.code === code);
    if (!row) throw new ApiError(`${capitalize(config.noun)} not found`, 404);
    return row;
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Same kind of messages as the other services: "<Label> is required." and so on
  const readName = (raw: string, errors: Record<string, string>) => {
    const value = (raw ?? "").trim();
    if (!value) errors.name = `${config.nameLabel} is required.`;
    else if (Array.from(value).length > config.nameMax)
      errors.name = `${config.nameLabel} can be at most ${config.nameMax} characters.`;
    return value;
  };

  const readCode = (raw: string, errors: Record<string, string>) => {
    const value = (raw ?? "").trim().toUpperCase();
    if (!value) errors.code = `${config.codeLabel} is required.`;
    else if (value.length > config.codeMax)
      errors.code = `${config.codeLabel} can be at most ${config.codeMax} characters.`;
    else if (!/^[A-Z0-9]+$/.test(value))
      errors.code = `${config.codeLabel} can only have letters and numbers.`;
    return value;
  };

  const fail = (errors: Record<string, string>) => {
    if (Object.keys(errors).length > 0)
      throw new ApiError("Please check the form.", 400, undefined, errors);
  };

  return {
    list({ tab, query, page, pageSize }) {
      const term = query.trim().toLowerCase();
      const matches = rows.filter(
        (r) =>
          !term || [r.code, r.name].some((v) => v.toLowerCase().includes(term)),
      );
      const counts = {
        active: matches.filter((r) => r.status === "Active").length,
        inactive: matches.filter((r) => r.status === "Inactive").length,
        all: matches.length,
      };
      const shown = matches
        .filter(
          (r) =>
            tab === "all" ||
            r.status === (tab === "active" ? "Active" : "Inactive"),
        )
        .sort((a, b) => a.code.localeCompare(b.code));
      const start = (page - 1) * pageSize;
      return {
        ok: true as const,
        items: shown.slice(start, start + pageSize).map((r) => ({ ...r })),
        total: shown.length,
        counts,
        page,
        pageSize,
      };
    },

    /** POST /api/jobs and POST /api/departments */
    create(input) {
      const errors: Record<string, string> = {};
      const code = readCode(input.code, errors);
      const name = readName(input.name, errors);
      fail(errors);
      // The code is the primary key, so a deleted row still holds its code
      if (rows.some((r) => r.code === code))
        throw new ApiError(
          `${config.codeLabel} ${code} already exists.`,
          409,
          undefined,
          { code: `${config.codeLabel} ${code} already exists.` },
        );
      const row: DemoLookupRow = {
        code,
        name,
        status: "Active",
        stamp: stamp("ADD"),
      };
      rows = [...rows, row];
      return row;
    },

    /** PATCH /api/jobs/:code and PATCH /api/departments/:code (the code itself never changes) */
    update(code, input) {
      const errors: Record<string, string> = {};
      const name = readName(input.name, errors);
      fail(errors);
      const current = find(code);
      if (current.status === "Inactive")
        throw new ApiError(
          `This ${config.noun} was deleted. Restore it before editing.`,
          409,
        );
      // Like the stamp trigger: nothing changed, so the stamp stays as it was
      if (current.name !== name) {
        current.name = name;
        current.stamp = stamp("EDIT");
      }
      rows = [...rows];
      return current;
    },

    /** DELETE /api/jobs/:code and DELETE /api/departments/:code (soft delete) */
    remove(code) {
      const current = find(code);
      if (current.status === "Inactive")
        throw new ApiError(`This ${config.noun} is already deleted.`, 409);
      const history = historyCount.get(code) ?? 0;
      if (history > 0) {
        throw new ApiError(
          `${code} cannot be deleted: it still has ${history} active ${config.childNoun}${history === 1 ? "" : "s"}.`,
          409,
        );
      }
      current.status = "Inactive";
      current.stamp = stamp("DELETE");
      rows = [...rows];
      return current;
    },

    /** PATCH /api/jobs/:code/restore and PATCH /api/departments/:code/restore */
    restore(code) {
      const current = find(code);
      if (current.status === "Active")
        throw new ApiError(`This ${config.noun} is not deleted.`, 409);
      current.status = "Active";
      current.stamp = stamp("RESTORE");
      rows = [...rows];
      return current;
    },
  };
}

// [jobCode, jobDesc, rows of jobHistory with that job]
const JOB_SEED: [string, string, number][] = [
  ["PRES", "President", 1],
  ["VP", "Vice president", 3],
  ["MGR", "Manager", 7],
  ["SA1", "Sales Agent 1", 13],
  ["SA2", "Sales Agent 2", 6],
  ["SPVR", "Supervisor", 7],
  ["CLK1", "Clerk 1", 3],
  ["CLK2", "Clerk 2", 3],
  ["PR1", "Programmer 1", 2],
  ["PR2", "Programmer 2", 2],
  ["ANYS", "Analyst", 2],
  ["ACCT", "Accountant", 2],
  ["WMAN", "Warehouse man", 3],
  ["HRS", "HR Specialist", 0],
];

// [deptCode, deptName, rows of jobHistory in that department]
const DEPARTMENT_SEED: [string, string, number][] = [
  ["ACT", "Accounting", 3],
  ["BR1", "Sales Branch 1", 16],
  ["BR2", "Sales Branch 2", 12],
  ["EXC", "Executive", 5],
  ["HRD", "Human Resource", 3],
  ["IT", "Information Tech", 7],
  ["PAY", "Payroll", 3],
  ["WHS", "Warehouse", 5],
];

// job.jobCode is VARCHAR(4) and job.jobDesc is VARCHAR(20)
export const demoJobs = createStore(
  {
    noun: "job",
    codeLabel: "Job code",
    nameLabel: "Job description",
    codeMax: 4,
    nameMax: 20,
    childNoun: "job history record",
  },
  JOB_SEED,
);

// department.deptCode is VARCHAR(3) and department.deptName is VARCHAR(20)
export const demoDepartments = createStore(
  {
    noun: "department",
    codeLabel: "Department code",
    nameLabel: "Department name",
    codeMax: 3,
    nameMax: 20,
    childNoun: "job history record",
  },
  DEPARTMENT_SEED,
);
