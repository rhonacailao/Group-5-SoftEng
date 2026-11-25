import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  demoHistoryOptions,
  makeJobHistoryStore,
  type DemoHistoryRow,
} from "../lib/demoEmployees";
import type { LookupRow } from "../lib/demoHumanResources";
import LookupPanel, { type LookupConfig } from "./LookupPanel";

type Props = {
  /** The employee. `code` is the employee number. */
  employee: LookupRow;
  /** EMPLOYEE_ADD / EMPLOYEE_EDIT / EMPLOYEE_DELETE of the person using the page */
  rights: string[];
  /** The offline demo account: use the in-memory job history instead of the server */
  isDemo: boolean;
  onClose: () => void;
};

type Option = { value: string; label: string };
type Lookup = { items: { code: string; name: string }[] };

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The job history of one employee (jobHistory table: a job, department and salary from an
 * effective date). It is a LookupPanel inside a dialog, so it has the same tabs, delete, restore,
 * stamps and rights as the other tabs. The job and the date are the key of a row: they are typed
 * when adding and cannot change afterwards.
 */
function JobHistoryDialog({ employee, rights, isDemo, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const empNo = employee.code;
  const name = `${String(employee.firstName)} ${String(employee.lastName)}`;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Active jobs and departments for the dropdowns, loaded once when the dialog opens
  const [options, setOptions] = useState<{
    jobs: Option[];
    departments: Option[];
  }>(() => (isDemo ? demoHistoryOptions() : { jobs: [], departments: [] }));
  useEffect(() => {
    if (isDemo) return;
    const toOptions = (res: Lookup) =>
      res.items.map((i) => ({ value: i.code, label: `${i.code} — ${i.name}` }));
    Promise.all([
      api<Lookup>("/api/jobs?status=active&pageSize=500"),
      api<Lookup>("/api/departments?status=active&pageSize=500"),
    ])
      .then(([jobs, departments]) =>
        setOptions({
          jobs: toOptions(jobs),
          departments: toOptions(departments),
        }),
      )
      .catch(() => {
        // The panel still lists the history; adding stays empty until the lists load
      });
  }, [isDemo]);

  // Same store for as long as the dialog is open (the panel reloads when it changes)
  const demo = useMemo(
    () => (isDemo ? makeJobHistoryStore(empNo) : undefined),
    [isDemo, empNo],
  );

  const config: LookupConfig = {
    title: "Job history",
    noun: "job history record",
    nounPlural: "job history records",
    codeLabel: "Record",
    endpoint: `/api/employees/${empNo}/job-history`,
    rightsPrefix: "EMPLOYEE",
    columns: [
      { key: "effDate", label: "Eff date", nowrap: true },
      {
        key: "jobCode",
        label: "Job",
        render: (r) => `${r.jobCode} — ${(r as DemoHistoryRow).jobDesc}`,
      },
      {
        key: "deptCode",
        label: "Department",
        hideBelow: "md",
        render: (r) => `${r.deptCode} — ${(r as DemoHistoryRow).deptName}`,
      },
      {
        key: "salary",
        label: "Salary",
        align: "right",
        nowrap: true,
        render: (r) => money(Number(r.salary)),
      },
    ],
    fields: [
      {
        key: "jobCode",
        label: "Job",
        type: "select",
        options: options.jobs,
        lockedOnEdit: true,
      },
      {
        key: "deptCode",
        label: "Department",
        type: "select",
        options: options.departments,
      },
      {
        key: "effDate",
        label: "Effective date",
        type: "date",
        lockedOnEdit: true,
      },
      { key: "salary", label: "Salary", maxLength: 13 },
    ],
    rowLabel: (r) => `${r.jobCode} from ${r.effDate}`,
    hideCodeInMessages: true,
    deleteNote: "",
    addLabel: "Add History",
    searchable: false,
    showTitle: false,
    pageSize: 50,
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="job-history-title"
      className="m-auto w-full max-w-4xl rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
    >
      <header className="flex items-start justify-between gap-4 border-b border-light-grey p-4 sm:p-6">
        <div>
          <h2 id="job-history-title" className="text-2xl font-bold">
            Job History — {empNo}
          </h2>
          <p className="mt-1 text-sm text-dark-grey">{name}</p>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="rounded-full px-2 py-1 text-dark-grey transition-colors duration-200 ease-in-out hover:text-dark"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </header>

      <div className="p-4 sm:p-6">
        <LookupPanel config={config} rights={rights} demo={demo} />
      </div>
    </dialog>
  );
}

export default JobHistoryDialog;
