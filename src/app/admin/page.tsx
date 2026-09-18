import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { CustomerStatusBadge, PasswordBadge, PaymentBadge } from "@/components/admin/Badges";
import { getCurrentAdmin } from "@/lib/session";
import { dashboardStats, listCustomersAdmin, listPaymentsAdmin } from "@/lib/db";
import { dateTime, inr } from "@/lib/format";

export default async function AdminDashboard() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const [stats, recentPayments, recentCustomers] = await Promise.all([
    dashboardStats(),
    listPaymentsAdmin({ page: 1, pageSize: 6 }),
    listCustomersAdmin({ page: 1, pageSize: 6 }),
  ]);
  const p = stats.payments;

  const tiles: {
    value: string | number;
    label: string;
    href: string;
    alert?: boolean;
    sub?: string;
  }[] = [
    { value: stats.customersTotal, label: "Total customers", href: "/admin/customers" },
    { value: stats.customersActive, label: "Active customers", href: "/admin/customers?status=active" },
    {
      value: stats.customersPending,
      label: "Pending activation",
      href: "/admin/customers?status=pending",
      sub: "Password not set yet",
    },
    {
      value: stats.applicationsPending,
      label: "Pending loan applications",
      href: "/admin/applications",
      alert: stats.applicationsPending > 0,
    },
    {
      value: p.pending.count,
      label: "Payments pending review",
      href: "/admin/payments?status=pending",
      alert: p.pending.count > 0,
      sub: p.pending.count ? inr(p.pending.amount) : undefined,
    },
    {
      value: p.approved.count,
      label: "Approved payments",
      href: "/admin/payments?status=approved",
      sub: inr(p.approved.amount),
    },
    { value: p.rejected.count, label: "Rejected payments", href: "/admin/payments?status=rejected" },
    {
      value: p.repayment_required.count,
      label: "Repayments required",
      href: "/admin/payments?status=repayment_required",
    },
    {
      value: p.refund_pending.count,
      label: "Refunds pending",
      href: "/admin/payments?status=refund_pending",
      alert: p.refund_pending.count > 0,
      sub: p.refund_pending.count ? inr(p.refund_pending.amount) : undefined,
    },
    {
      value: p.refunded.count,
      label: "Refunded",
      href: "/admin/payments?status=refunded",
      sub: p.refunded.count ? inr(p.refunded.amount) : undefined,
    },
    {
      value: stats.loansAwaiting,
      label: "Loans awaiting customer payment",
      href: "/admin/orders?view=awaiting",
      sub: "No UTR submitted yet",
    },
    { value: stats.loansActive, label: "Active loans", href: "/admin/orders?view=all" },
    { value: stats.loansCancelled, label: "Cancelled loans", href: "/admin/orders?view=cancelled" },
    { value: inr(stats.outstanding), label: "Outstanding due", href: "/admin/orders?view=all" },
  ];

  return (
    <AdminShell active="dashboard" adminName={admin.name} adminRole={admin.role}>
      <div className="adm-page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="adm-lead">Overview of customers, loans and repayments.</p>
        </div>
        <Link href="/admin/customers/new" className="adm-btn adm-btn-primary">
          + New customer
        </Link>
      </div>

      <div className="adm-cards">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={t.alert ? "adm-card alert" : "adm-card"}>
            <b>{t.value}</b>
            <small>{t.label}</small>
            {t.sub ? <em>{t.sub}</em> : null}
          </Link>
        ))}
      </div>

      <div className="adm-section">
        <h2>Needs your attention</h2>
        <div className="adm-note adm-note-top">
          {p.pending.count > 0 ? (
            <p>
              {p.pending.count} payment{p.pending.count > 1 ? "s are" : " is"} waiting
              for manual verification.{" "}
              <Link href="/admin/payments?status=pending">Open the review queue →</Link>
            </p>
          ) : null}
          {stats.loansAwaiting > 0 ? (
            <p>
              {stats.loansAwaiting} loan{stats.loansAwaiting > 1 ? "s are" : " is"} awaiting
              customer payment — you can mark paid, cancel or keep pending without a UTR.{" "}
              <Link href="/admin/orders?view=awaiting">Manage loans →</Link>
            </p>
          ) : null}
          {p.refund_pending.count > 0 ? (
            <p>
              {p.refund_pending.count} refund{p.refund_pending.count > 1 ? "s" : ""} to
              send. <Link href="/admin/payments?status=refund_pending">Record refunds →</Link>
            </p>
          ) : null}
          {stats.applicationsPending > 0 ? (
            <p>
              {stats.applicationsPending} loan application
              {stats.applicationsPending > 1 ? "s" : ""} awaiting a decision.{" "}
              <Link href="/admin/applications">Review applications →</Link>
            </p>
          ) : null}
          {p.pending.count + p.refund_pending.count + stats.applicationsPending + stats.loansAwaiting === 0 ? (
            <p>Nothing needs your attention right now.</p>
          ) : null}
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="adm-section">
          <h2>
            Recent payments <Link href="/admin/payments?status=all">View all</Link>
          </h2>
          {recentPayments.rows.length === 0 ? (
            <div className="adm-empty">No payments yet.</div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.rows.map((pay) => (
                    <tr key={pay.id}>
                      <td>
                        <Link href={`/admin/payments/${pay.id}`} className="adm-link">
                          {pay.customerName ?? "—"}
                        </Link>
                        <div className="adm-micro adm-mono">{pay.utr}</div>
                      </td>
                      <td>{inr(pay.amount)}</td>
                      <td>
                        <PaymentBadge status={pay.status} />
                      </td>
                      <td>{dateTime(pay.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="adm-section">
          <h2>
            Recent customers <Link href="/admin/customers">View all</Link>
          </h2>
          {recentCustomers.rows.length === 0 ? (
            <div className="adm-empty">No customers yet.</div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Password</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCustomers.rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/customers/${c.id}`} className="adm-link">
                          {c.name}
                        </Link>
                        <div className="adm-micro">{dateTime(c.createdAt)}</div>
                      </td>
                      <td>
                        <CustomerStatusBadge status={c.status} />
                      </td>
                      <td>
                        <PasswordBadge customer={c} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
