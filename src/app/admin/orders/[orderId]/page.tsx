import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import Flash from "@/components/admin/Flash";
import LoanActions from "@/components/admin/LoanActions";
import { LoanBadge, PaymentBadge } from "@/components/admin/Badges";
import { getCurrentAdmin } from "@/lib/session";
import { getOrderRow, getPaymentsForOrder, getSettings, listAuditLogs } from "@/lib/db";
import { dateTime, inr, shortDate } from "@/lib/format";
import { repaymentUpi } from "@/lib/loan";
import { auditLabel } from "@/lib/status";

// One loan: its state, how it was closed, every payment attempt and its audit
// trail. Loan actions are available whether or not a UTR was ever submitted.
export default async function LoanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { orderId } = await params;
  const { notice } = await searchParams;
  const order = await getOrderRow(orderId);
  if (!order) notFound();

  const [payments, trail, settings] = await Promise.all([
    getPaymentsForOrder(order.id),
    listAuditLogs({ orderId: order.id, pageSize: 50 }),
    getSettings(),
  ]);
  const { upiId } = repaymentUpi(order, settings);

  return (
    <AdminShell active="orders" adminName={admin.name} adminRole={admin.role}>
      <Flash notice={notice} />
      <Link href="/admin/orders" className="adm-back">
        ← Loans
      </Link>
      <div className="adm-page-head">
        <div>
          <h1>
            {order.productName} <LoanBadge order={order} />
          </h1>
          <p className="adm-lead">
            <Link href={`/admin/customers/${order.customerId}`} className="adm-link">
              {order.customerName ?? order.customerId}
            </Link>{" "}
            · <span className="adm-mono">{order.id}</span>
          </p>
        </div>
        <LoanActions
          order={order}
          pendingPaymentId={order.pendingPaymentId}
          returnTo={`/admin/orders/${order.id}`}
        />
      </div>

      <div className="adm-grid-2">
        <div className="adm-section">
          <h2>Loan</h2>
          <dl className="adm-dl">
            <dt>Product</dt>
            <dd>{order.productName}</dd>
            <dt>Loan amount</dt>
            <dd>{inr(order.principal)}</dd>
            <dt>Still due</dt>
            <dd>{order.status === "cancelled" ? "— (cancelled)" : inr(order.amountDue)}</dd>
            <dt>Paid</dt>
            <dd>{order.amountPaid ? inr(order.amountPaid) : "—"}</dd>
            <dt>Due date</dt>
            <dd>{shortDate(order.dueDate)}</dd>
            <dt>Status</dt>
            <dd>
              <LoanBadge order={order} />
            </dd>
            <dt>Repayment UPI</dt>
            <dd className="adm-mono">
              {upiId}
              {order.upiId ? "" : <span className="adm-micro"> (from Settings)</span>}
            </dd>
            <dt>Created</dt>
            <dd>{dateTime(order.createdAt)}</dd>
            <dt>Last updated</dt>
            <dd>{dateTime(order.updatedAt ?? order.createdAt)}</dd>
          </dl>
        </div>

        <div className="adm-section">
          <h2>Payment &amp; closure</h2>
          <dl className="adm-dl">
            <dt>Customer UTR</dt>
            <dd>
              {order.pendingPaymentId ? (
                <Link href={`/admin/payments/${order.pendingPaymentId}`} className="adm-link">
                  Submitted — awaiting review
                </Link>
              ) : payments.length > 0 ? (
                `${payments.length} payment attempt${payments.length > 1 ? "s" : ""}`
              ) : (
                "None submitted"
              )}
            </dd>
            {order.settledAt ? (
              <>
                <dt>Marked paid</dt>
                <dd>
                  {dateTime(order.settledAt)} by {order.settledByName} ·{" "}
                  {inr(order.settledAmount ?? 0)} · no UTR
                </dd>
                {order.settlementNote ? (
                  <>
                    <dt>Note</dt>
                    <dd>{order.settlementNote}</dd>
                  </>
                ) : null}
              </>
            ) : null}
            {order.cancelledAt ? (
              <>
                <dt>Cancelled</dt>
                <dd>
                  {dateTime(order.cancelledAt)} by {order.cancelledByName}
                </dd>
                <dt>Reason</dt>
                <dd>
                  {order.cancelReason}
                  {order.cancelNote ? ` — ${order.cancelNote}` : ""}
                </dd>
              </>
            ) : null}
            {order.paidAt && !order.settledAt ? (
              <>
                <dt>Paid</dt>
                <dd>{dateTime(order.paidAt)} (approved payment)</dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>

      <div className="adm-section">
        <h2>Payment attempts ({payments.length})</h2>
        {payments.length === 0 ? (
          <div className="adm-empty">The customer hasn&apos;t submitted a UTR for this loan.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Submitted</th>
                  <th>Amount</th>
                  <th>UTR</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/payments/${p.id}`} className="adm-link adm-mono">
                        {p.id}
                      </Link>
                    </td>
                    <td>{dateTime(p.createdAt)}</td>
                    <td>{inr(p.amount)}</td>
                    <td className="adm-mono">{p.utr}</td>
                    <td>
                      <PaymentBadge status={p.status} />
                    </td>
                    <td>
                      {p.reviewedAt ? `${dateTime(p.reviewedAt)} · ${p.reviewedByName}` : "—"}
                    </td>
                    <td className="wrap">{p.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-section">
        <h2>Audit trail</h2>
        {trail.rows.length === 0 ? (
          <div className="adm-empty">No recorded activity for this loan.</div>
        ) : (
          <ul className="adm-timeline">
            {trail.rows.map((log) => (
              <li key={log.id}>
                <time>{dateTime(log.createdAt)}</time>
                <div>
                  <b>{auditLabel(log.action)}</b>{" "}
                  <span className="adm-micro">
                    by {log.userName} ({log.userType})
                  </span>
                  {log.reason ? <div>Reason: {log.reason}</div> : null}
                  {log.details ? <div className="adm-muted">{log.details}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
