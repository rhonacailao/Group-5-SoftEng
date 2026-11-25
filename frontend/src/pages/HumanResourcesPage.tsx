import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";
import ErrorBanner from "../components/ErrorBanner";
import JobHistoryButton from "../components/JobHistoryButton";
import LookupPanel, { type LookupConfig } from "../components/LookupPanel";
import { describeError, type ErrorInfo } from "../lib/errorInfo";
import {
  DEMO_HR_RIGHTS,
  demoDepartments,
  demoJobs,
  type DemoStore,
} from "../lib/demoHumanResources";
import { demoEmployees, NAME_MAX } from "../lib/demoEmployees";

type SectionId = "employees" | "jobs" | "departments";

type MenuResponse = { ok: true; tiles: { code: string; rights: string[] }[] };

const DEMO_USER_ID = 0; // the offline demo account has no server session (see authStore.ts)

const sections: { id: SectionId; label: string }[] = [
  { id: "employees", label: "Employees" },
  { id: "jobs", label: "Jobs" },
  { id: "departments", label: "Departments" },
];

// employee.empno is VARCHAR(5) and given by the system; lastname and firstname are VARCHAR(15);
// gender is M or F; birthdate, hiredate and sepDate are DATE (sepDate stays empty while employed)
const employeeConfig: LookupConfig = {
  title: "Employees",
  noun: "employee",
  nounPlural: "employees",
  codeLabel: "Employee no.",
  endpoint: "/api/employees",
  rightsPrefix: "EMPLOYEE",
  autoCode: true,
  columns: [
    { key: "lastName", label: "Last name" },
    { key: "firstName", label: "First name" },
    { key: "gender", label: "Gender", hideBelow: "md" },
    { key: "birthDate", label: "Birth date", nowrap: true, hideBelow: "xl" },
    { key: "hireDate", label: "Hire date", nowrap: true, hideBelow: "lg" },
    { key: "sepDate", label: "Sep date", nowrap: true, hideBelow: "xl" },
  ],
  fields: [
    { key: "lastName", label: "Last name", maxLength: NAME_MAX },
    { key: "firstName", label: "First name", maxLength: NAME_MAX },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      options: [
        { value: "M", label: "M (Male)" },
        { value: "F", label: "F (Female)" },
      ],
    },
    { key: "birthDate", label: "Birth date", type: "date" },
    { key: "hireDate", label: "Hire date", type: "date" },
    {
      key: "sepDate",
      label: "Separation date (optional)",
      type: "date",
      hint: "Leave empty while the employee is still with the company.",
    },
  ],
  rowLabel: (row) => `${String(row.firstName)} ${String(row.lastName)}`,
  deleteNote:
    "An employee that still has active job history cannot be deleted: delete the history first.",
  pageSize: 10,
};

// job.jobCode is VARCHAR(4), job.jobDesc is VARCHAR(20)
const jobConfig: LookupConfig = {
  title: "Jobs",
  noun: "job",
  nounPlural: "jobs",
  codeLabel: "Job code",
  nameLabel: "Job description",
  codeMax: 4,
  nameMax: 20,
  endpoint: "/api/jobs",
  rightsPrefix: "JOB",
};

// department.deptCode is VARCHAR(3), department.deptName is VARCHAR(20)
const departmentConfig: LookupConfig = {
  title: "Departments",
  noun: "department",
  nounPlural: "departments",
  codeLabel: "Department code",
  nameLabel: "Department name",
  codeMax: 3,
  nameMax: 20,
  endpoint: "/api/departments",
  rightsPrefix: "DEPARTMENT",
};

function HumanResourcesPage() {
  const user = useAuthStore((s) => s.user);
  const isDemo = user?.id === DEMO_USER_ID;

  const [section, setSection] = useState<SectionId>("employees");
  // Rights per tile code ("JOB", "DEPARTMENT"), from the Rights dialog through GET /api/menu.
  const [rights, setRights] = useState<Record<string, string[]>>({});
  const [rightsError, setRightsError] = useState<ErrorInfo | null>(null);

  // Rights, once
  useEffect(() => {
    const load: Promise<Record<string, string[]>> = isDemo
      ? Promise.resolve(DEMO_HR_RIGHTS)
      : api<MenuResponse>("/api/menu").then((menu) =>
          Object.fromEntries(menu.tiles.map((t) => [t.code, t.rights])),
        );
    load.then(setRights).catch((err) => setRightsError(describeError(err)));
  }, [isDemo]);

  const panels: Record<SectionId, { config: LookupConfig; demo: DemoStore }> = {
    employees: { config: employeeConfig, demo: demoEmployees },
    jobs: { config: jobConfig, demo: demoJobs },
    departments: { config: departmentConfig, demo: demoDepartments },
  };

  return (
    <section aria-labelledby="hr-title" className="flex flex-col gap-6">
      <header>
        <h1 id="hr-title" className="text-5xl font-bold leading-none">
          Human Resources
        </h1>
      </header>

      {isDemo && (
        <p role="status" className="text-xs italic">
          Demo
        </p>
      )}
      {rightsError && (
        <ErrorBanner title={rightsError.title} message={rightsError.message} />
      )}

      {/*----------Sub-tabs: Employees, Jobs, Departments----------*/}
      <div
        role="tablist"
        aria-label="Human Resources sections"
        className="flex gap-6 border-b border-light-grey"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            id={`hr-tab-${s.id}`}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            aria-controls={`hr-panel-${s.id}`}
            onClick={() => setSection(s.id)}
            className={`-mb-px border-b-2 px-1 pb-2 font-semibold transition-colors duration-200 ease-in-out ${
              section === s.id
                ? "border-fire text-dark"
                : "border-transparent text-dark-grey hover:text-dark"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        id={`hr-panel-${section}`}
        role="tabpanel"
        aria-labelledby={`hr-tab-${section}`}
      >
        <LookupPanel
          // A new key resets search, tab and page when switching between the tabs
          key={section}
          config={panels[section].config}
          rights={rights[panels[section].config.rightsPrefix] ?? []}
          demo={isDemo ? panels[section].demo : undefined}
          rowActions={
            section === "employees"
              ? (row) => (
                  <JobHistoryButton
                    employee={row}
                    rights={rights.EMPLOYEE ?? []}
                    isDemo={isDemo}
                  />
                )
              : undefined
          }
        />
      </div>
    </section>
  );
}

export default HumanResourcesPage;
