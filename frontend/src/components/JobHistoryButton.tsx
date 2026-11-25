import { useState } from "react";
import type { LookupRow } from "../lib/demoHumanResources";
import JobHistoryDialog from "./JobHistoryDialog";

type Props = {
  employee: LookupRow;
  rights: string[];
  isDemo: boolean;
};

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm transition-colors duration-200 ease-in-out hover:bg-light-grey disabled:opacity-60";

/** The History button in an employee's row. It opens the job history dialog of that employee. */
function JobHistoryButton({ employee, rights, isDemo }: Props) {
  const [open, setOpen] = useState(false);
  const name = `${String(employee.firstName)} ${String(employee.lastName)}`;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Job history of ${name}`}
        className={actionButton}
      >
        History
      </button>
      {open && (
        <JobHistoryDialog
          employee={employee}
          rights={rights}
          isDemo={isDemo}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export default JobHistoryButton;
