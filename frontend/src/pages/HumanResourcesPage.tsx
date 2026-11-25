import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LookupPanel, { type LookupConfig } from "../components/LookupPanel";
import { describeError, type ErrorInfo } from "../lib/errorInfo";
import {
  DEMO_HR_RIGHTS,
  demoDepartments,
  demoJobs,
  type DemoStore,
} from "../lib/demoHumanResources";

type SectionId = "employees" | "jobs" | "departments";

type MenuResponse = { ok: true; tiles: { code: string; rights: string[] }[] };

const DEMO_USER_ID = 0; // the offline demo account has no server session (see authStore.ts)

const sections: { id: SectionId; label: string }[] = [
  { id: "employees", label: "Employees" },
  { id: "jobs", label: "Jobs" },
  { id: "departments", label: "Departments" },
];

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

  const [section, setSection] = useState<SectionId>("jobs");
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

  const panels: Record<
    Exclude<SectionId, "employees">,
    { config: LookupConfig; demo: DemoStore }
  > = {
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
        <p role="status" className="rounded-md bg-cream px-4 py-2">
          You are using the demo account with sample jobs and departments. It is
          not connected to the server, so your changes stay in this browser tab
          and reset when you refresh. Log in with a real account to manage the
          real lists.
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
        {/* Employees is empty for now: the employee list comes in a later sprint */}
        {section === "employees" ? (
          <Card className="p-2">
            <EmptyState icon="fa-id-badge" title="Employees">
              Employee records will be shown here.
            </EmptyState>
          </Card>
        ) : (
          <LookupPanel
            // A new key resets search, tab and page when switching between Jobs and Departments
            key={section}
            config={panels[section].config}
            rights={rights[panels[section].config.rightsPrefix] ?? []}
            demo={isDemo ? panels[section].demo : undefined}
          />
        )}
      </div>
    </section>
  );
}

export default HumanResourcesPage;
