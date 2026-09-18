import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import CopyButton from "@/components/CopyButton";
import Flash from "@/components/admin/Flash";
import PaymentActions from "@/components/admin/PaymentActions";
import ProofViewer from "@/components/admin/ProofViewer";
import { CustomerStatusBadge, PaymentBadge } from "@/components/admin/Badges";
import { getCurrentAdmin } from "@/lib/session";
import {
  getCustomerById,
  getOrder,
  getPayment,
  getPaymentsForOrder,
  listAuditLogs,
} from "@/lib/db";
import { dateTime, inr, shortDate } from "@/lib/format";
import { auditLabel, paymentMethodLabel } from "@/lib/status";


export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { paymentId } = await params;
  const { notice } = await searchParams;
  const payment = await getPayment(paymentId);
  if (!payment) notFound();

  const [customer, order, attempts, trail] = await Promise.all([
    getCustomerById(payment.customerId),
    getOrder(payment.orderId),
    getPaymentsForOrder(payment.orderId),
    listAuditLogs({ paymentId: payment.id, pageSize: 50 }),
  ]);
  const returnTo = `/admin/payments/${payment.id}`;

  return (
    <AdminShell active="payments" adminName={admin.name} adminRole={admin.role}>
      <Flash notice={notice} />
      <Link href="/admin/payments" className="adm-back">
        ← Payments
      </Link>
      <div className="adm-page-head">
        <div>
          <h1>
            {inr(payment.amount)} <PaymentBadge status={payment.status} />
          </h1>
          <p className="adm-lead adm-mono">
            {payment.id} · UTR {payment.utr}
          </p>
        </div>
        <PaymentActions payment={payment} returnTo={returnTo} />
      </div>

      <div className="adm-grid-2">
        <div className="adm-section">
          <h2>Payment</h2>
          <dl className="adm-dl">
            <dt>Transaction ID</dt>
            <dd className="adm-mono">{payment.id}</dd>
            <dt>UTR / reference</dt>
            <dd className="adm-mono adm-utr">
              {payment.utr} <CopyButton value={payment.utr} className="adm-copy-mini" />
            </dd>
            <dt>Amount submitted</dt>
            <dd>{inr(payment.amount)}</dd>
            {payment.approvedAmount !== undefined ? (
              <>
                <dt>Verified amount</dt>
                <dd>{inr(payment.approvedAmount)}</dd>
              </>
            ) : null}
            <dt>Due at submission</dt>
            <dd>
              {payment.amountDueAtSubmission !== undefined
                ? inr(payment.amountDueAtSubmission)
                : "—"}
            </dd>
            <dt>Payment method</dt>
            <dd>
              {paymentMethodLabel(payment)}
            </dd>
            <dt>Paid to (UPI)</dt>
            <dd className="adm-mono">{payment.upiId}</dd>
            <dt>Payment date</dt>
            <dd>{payment.paymentDate ? shortDate(payment.paymentDate) : "—"}</dd>
            <dt>Submitted</dt>
            <dd>{dateTime(payment.createdAt)}</dd>
            <dt>Status</dt>
            <dd>
              <PaymentBadge status={payment.status} />
            </dd>
            <dt>Reviewed</dt>
            <dd>
              {payment.reviewedAt
                ? `${dateTime(payment.reviewedAt)} by ${payment.reviewedByName ?? payment.reviewedBy}`
                : "Not yet"}
            </dd>
            {payment.reason ? (
              <>
                <dt>Rejection reason</dt>
                <dd>{payment.reason}</dd>
              </>
            ) : null}
            {payment.reviewNote ? (
              <>
                <dt>Review note</dt>
                <dd>{payment.reviewNote}</dd>
              </>
            ) : null}
            {payment.refundInitiatedAt ? (
              <>
                <dt>Refund initiated</dt>
                <dd>
                  {dateTime(payment.refundInitiatedAt)} by {payment.refundInitiatedByName}
                </dd>
              </>
            ) : null}
            {payment.refundedAt ? (
              <>
                <dt>Refunded</dt>
                <dd>
                  {shortDate(payment.refundedAt)} by {payment.refundedByName} · ref{" "}
                  <span className="adm-mono">{payment.refundReference}</span>
                </dd>
              </>
            ) : null}
            {payment.refundNote ? (
              <>
                <dt>Refund note</dt>
                <dd>{payment.refundNote}</dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="adm-section">
          <h2>Screenshot</h2>
          <div className="adm-pad">
            {payment.hasProof ? (
              <ProofViewer
                src={`/admin/payments/${payment.id}/proof`}
                label={`Screenshot · ${payment.customerName ?? ""} · UTR ${payment.utr}`}
              />
            ) : (
              <div className="adm-proof-missing">No screenshot was uploaded.</div>
            )}
          </div>
          <h2 className="adm-h2-split">Customer</h2>
          {customer ? (
            <dl className="adm-dl">
              <dt>Name</dt>
              <dd>
                <Link href={`/admin/customers/${customer.id}`} className="adm-link">
                  {customer.name}
                </Link>{" "}
                <CustomerStatusBadge status={customer.status} />
              </dd>
              <dt>Customer ID</dt>
              <dd className="adm-mono">{customer.customerCode ?? customer.id}</dd>
              <dt>Mobile</dt>
              <dd className="adm-mono">+91 {customer.mobile}</dd>
              <dt>Customer UPI</dt>
              <dd className="adm-mono">{customer.upiId || "—"}</dd>
              <dt>Loan</dt>
              <dd>
                {order
                  ? `${order.productName} · ${order.id} · ${order.amountDue > 0 ? `${inr(order.amountDue)} due` : "fully repaid"}`
                  : payment.orderId}
              </dd>
            </dl>
          ) : (
            <div className="adm-empty">Customer record no longer exists.</div>
          )}
        </div>
      </div>

      <div className="adm-section">
        <h2>All payment attempts for this loan ({attempts.length})</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Submitted</th>
                <th>Amount</th>
                <th>UTR</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className={a.id === payment.id ? "adm-row-current" : undefined}>
                  <td>
                    <Link href={`/admin/payments/${a.id}`} className="adm-link adm-mono">
                      {a.id}
                    </Link>
                  </td>
                  <td>{dateTime(a.createdAt)}</td>
                  <td>{inr(a.amount)}</td>
                  <td className="adm-mono">{a.utr}</td>
                  <td>
                    <PaymentBadge status={a.status} />
                  </td>
                  <td className="wrap">{a.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-section">
        <h2>Audit trail</h2>
        {trail.rows.length === 0 ? (
          <div className="adm-empty">No recorded activity for this payment.</div>
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
