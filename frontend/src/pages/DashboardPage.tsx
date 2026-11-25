import { Link } from "react-router-dom";
import Card from "../components/Card";
import Badge, { type BadgeVariant } from "../components/Badge";

// Figures are mock data modelled on the Hope, Inc. database
// (customer, product, sales / salesDetail, payment tables).
type Status = "Pending" | "Done" | "Overdue";

type Deliverable = {
  task: string;
  ref: string;
  relatedTo: string;
  due: string;
  status: Status;
};

const stats = [
  { label: "Total customers", value: "82", note: "Registered accounts" },
  { label: "Products", value: "57", note: "In the catalogue" },
  {
    label: "Open orders",
    value: "14",
    note: "Awaiting delivery or payment",
  },
  {
    label: "Revenue",
    value: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(665326.58),
    note: "Payments received",
  },
];

const deliverables: Deliverable[] = [
  {
    task: "Ship order",
    ref: "TR000125",
    relatedTo: "Globus Medical, Inc",
    due: "Nov 3, 2026",
    status: "Overdue",
  },
  {
    task: "Collect 30-day payment",
    ref: "TR000119",
    relatedTo: "HMS Holdings, Inc",
    due: "Nov 4, 2026",
    status: "Overdue",
  },
  {
    task: "Deliver 12 items",
    ref: "TR000126",
    relatedTo: "Astronics, Inc",
    due: "Nov 7, 2026",
    status: "Pending",
  },
  {
    task: "Prepare invoice",
    ref: "TR000127",
    relatedTo: "RF Industries, Inc",
    due: "Nov 9, 2026",
    status: "Pending",
  },
  {
    task: "Restock Toshiba Canvio 1 TB",
    ref: "AD0001",
    relatedTo: "Warehouse",
    due: "Nov 10, 2026",
    status: "Pending",
  },
  {
    task: "Deliver order",
    ref: "TR000123",
    relatedTo: "Abaxis, Inc",
    due: "Nov 5, 2026",
    status: "Done",
  },
  {
    task: "Issue official receipt",
    ref: "OR000165",
    relatedTo: "Landec Corp.",
    due: "Nov 2, 2026",
    status: "Done",
  },
  {
    task: "Confirm COD delivery",
    ref: "TR000122",
    relatedTo: "Trisha Macdowell",
    due: "Nov 1, 2026",
    status: "Done",
  },
];

const quickActions = [
  {
    to: "/customers",
    label: "View customers",
    note: "Browse and review accounts",
    icon: "fa-users",
  },
  {
    to: "/products",
    label: "Manage products",
    note: "Update the catalogue and prices",
    icon: "fa-box",
  },
  {
    to: "/sales",
    label: "Sales pipeline",
    note: "Track orders and payments",
    icon: "fa-chart-line",
  },
];

const statusVariant: Record<Status, BadgeVariant> = {
  Pending: "info",
  Done: "success",
  Overdue: "danger",
};

function DashboardPage() {
  const count = (s: Status) =>
    deliverables.filter((d) => d.status === s).length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-5xl font-bold leading-none">Dashboard</h1>
      </header>

      {/*----------Statistics----------*/}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Key statistics
        </h2>
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, note }) => (
            <Card key={label} className="p-6 text-center">
              <dt className="text-xl font-semibold text-dark-grey">{label}</dt>
              <dd className="mt-2">
                <span className="block text-5xl font-bold leading-none">
                  {value}
                </span>
                <span className="mt-2 block text-sm text-dark-grey">
                  {note}
                </span>
              </dd>
            </Card>
          ))}
        </dl>
      </section>

      {/*----------Quick actions----------*/}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="mb-4 text-2xl font-bold">
          Quick actions
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {quickActions.map(({ to, label, note, icon }) => (
            <li key={to}>
              <Card
                as={Link}
                to={to}
                className="flex h-full items-center gap-4 p-6 transition-colors duration-200 ease-in-out hover:bg-white"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-fire text-2xl text-white">
                  <i className={`fa-solid ${icon}`} aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold">{label}</span>
                  <span className="block text-sm text-dark-grey">{note}</span>
                </span>
                <i
                  className="fa-solid fa-arrow-right text-fire"
                  aria-hidden="true"
                />
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/*----------Upcoming deliverables----------*/}
      <Card as="section" aria-labelledby="deliverables-heading" className="p-6">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="deliverables-heading" className="text-2xl font-bold">
            Upcoming deliverables
          </h2>
          <p className="text-sm text-dark-grey">
            {count("Overdue")} overdue &middot; {count("Pending")} pending
            &middot; {count("Done")} done
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              Deliverables with their due dates and status
            </caption>
            <thead>
              <tr className="border-b border-light-grey text-sm text-dark-grey">
                <th scope="col" className="px-2 py-2 font-semibold">
                  Deliverable
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Reference
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Related to
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Due
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-grey">
              {deliverables.map((d) => (
                <tr key={`${d.ref}-${d.task}`}>
                  <td className="px-2 py-3 font-semibold">{d.task}</td>
                  <td className="px-2 py-3 text-dark-grey">{d.ref}</td>
                  <td className="px-2 py-3">{d.relatedTo}</td>
                  <td className="px-2 py-3">
                    <time>{d.due}</time>
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant={statusVariant[d.status]}>{d.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default DashboardPage;
