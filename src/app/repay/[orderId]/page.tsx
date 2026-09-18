import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import CopyButton from "@/components/CopyButton";
import CustomerPayments, {
  PaymentStatusNote,
  PaymentStatusPill,
} from "@/components/CustomerPayments";
import RepaymentForm from "@/components/RepaymentForm";
import { getCurrentCustomer } from "@/lib/session";
import { getOrder, getPaymentsForOrder, getSettings, getUpiQrInfo } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";
import { isOverdue, repaymentUpi } from "@/lib/loan";
import { NOT_ACCEPTED } from "@/lib/status";
import { upiQrDataUri } from "@/lib/upi";
import type { Order } from "@/lib/types";

function LoanSummary({ order }: { order: Order }) {
  const overdue = isOverdue(order);
  return (
    <div className="mloan-due-summary">
      <h2>{order.productName}</h2>
      <dl>
        <div>
          <dt>{order.status === "paid" || order.status === "cancelled" ? "Amount" : "Amount Due"}</dt>
          <dd className="mloan-due-amount">
            {inr(
              order.status === "paid"
                ? order.amountPaid ?? order.principal
                : order.status === "cancelled"
                  ? order.principal
                  : order.amountDue,
            )}
          </dd>
        </div>
        <div>
          <dt>Due Date</dt>
          <dd>
            {shortDate(order.dueDate)}
            {overdue ? <span className="mloan-overdue-tag">Overdue</span> : null}
          </dd>
        </div>
      </dl>
      <small>Loan ID {order.id}</small>
    </div>
  );
}

export default async function RepayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const { orderId } = await params;
  const { submitted } = await searchParams;
  const order = await getOrder(orderId);
  // Server-side ownership check: another customer's loan is simply not found.
  if (!order || order.customerId !== customer.id) notFound();

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const payments = await getPaymentsForOrder(order.id); // newest first
  const latest = payments[0];

  const history =
    payments.length > 0 ? (
      <section className="mloan-payment-page">
        <div className="mloan-section-heading simple">
          <h2>Payment history</h2>
        </div>
        <CustomerPayments payments={payments} />
      </section>
    ) : null;

  // Paid & closed --------------------------------------------------------------
  if (order.status === "paid") {
    return (
      <AppShell variant="inner" title="Repayment" initial={initial} back="/orders">
        <section className="mloan-payment-page">
          <LoanSummary order={order} />
          <div className="mloan-payment-result mloan-payment-success">
            <span className="mloan-result-icon mloan-result-success-icon" aria-hidden>
              ✓
            </span>
            <strong>{order.settledAt ? "Loan Paid" : "Payment Successful"}</strong>
            <span>
              {order.settledAt
                ? `Marked as paid by our team on ${shortDate(order.settledAt)}. No further payment is needed.`
                : "This loan is fully repaid and closed. Thank you."}
            </span>
            <Link className="mloan-btn mloan-btn-secondary mloan-result-action" href="/orders">
              Back to my loans
            </Link>
          </div>
        </section>
        {history}
      </AppShell>
    );
  }

  // Cancelled by the operator: nothing to pay ----------------------------------
  if (order.status === "cancelled") {
    return (
      <AppShell variant="inner" title="Repayment" initial={initial} back="/orders">
        <section className="mloan-payment-page">
          <LoanSummary order={order} />
          <div className="mloan-payment-result mloan-payment-failed">
            <span className="mloan-result-icon mloan-result-failed-icon" aria-hidden>
              ✕
            </span>
            <strong>Loan Cancelled</strong>
            <span>
              {order.cancelReason ? `Reason: ${order.cancelReason}.` : ""}
              {order.cancelNote ? ` ${order.cancelNote}` : ""} This loan was cancelled
              {order.cancelledAt ? ` on ${shortDate(order.cancelledAt)}` : ""}. No payment is
              needed.
            </span>
            <Link className="mloan-btn mloan-btn-secondary mloan-result-action" href="/orders">
              Back to my loans
            </Link>
          </div>
        </section>
        {history}
      </AppShell>
    );
  }

  // Submitted, awaiting manual verification -----------------------------------
  if (order.status === "review") {
    return (
      <AppShell variant="inner" title="Repayment" initial={initial} back="/orders">
        <section className="mloan-payment-page">
          {submitted ? (
            <div className="mloan-alert success" role="status">
              Payment submitted — thank you! We&apos;ll notify you once it&apos;s verified.
            </div>
          ) : null}
          <LoanSummary order={order} />
          <div className="mloan-payment-result">
            <span className="mloan-result-icon mloan-review-pending-icon" aria-hidden>
              ⏳
            </span>
            <strong>Payment Pending</strong>
            <span>
              We&apos;ve received your UTR and are verifying it against our bank
              records. This is checked by a person — it isn&apos;t approved
              automatically. You&apos;ll see it marked successful once confirmed.
            </span>
            {latest ? (
              <div className="mloan-review-utr">
                {inr(latest.amount)} · UTR submitted: <strong>{latest.utr}</strong>
              </div>
            ) : null}
            <Link className="mloan-btn mloan-btn-secondary mloan-result-action" href="/orders">
              Back to my loans
            </Link>
          </div>
        </section>
        {history}
      </AppShell>
    );
  }

  // Due / overdue — outcome of the last attempt, then how to pay ---------------
  const [settings, uploadedQr] = await Promise.all([getSettings(), getUpiQrInfo()]);
  const { upiId, payeeName } = repaymentUpi(order, settings);
  // An uploaded QR only applies to the collection UPI from Settings; a loan
  // with its own UPI ID always gets a QR generated for that UPI ID.
  const useUploadedQr = Boolean(uploadedQr) && upiId === settings.upiId;
  const qrSrc = useUploadedQr
    ? `/upi-qr?v=${encodeURIComponent(uploadedQr!.updatedAt)}`
    : await upiQrDataUri({
        vpa: upiId,
        payeeName,
        amount: order.amountDue,
        note: `${order.productName} ${order.id}`,
      });
  const lastNotAccepted = latest && NOT_ACCEPTED.includes(latest.status) ? latest : null;
  const lastApproved = latest?.status === "approved" ? latest : null;

  return (
    <AppShell variant="inner" title="Repayment" initial={initial} back="/orders">
      <section className="mloan-payment-page">
        {lastNotAccepted ? (
          <div
            className={
              lastNotAccepted.status === "refunded"
                ? "mloan-alert mloan-alert-warning"
                : "mloan-alert mloan-alert-error"
            }
            role="status"
          >
            <div className="mloan-alert-title">
              Your last payment: <PaymentStatusPill status={lastNotAccepted.status} />
            </div>
            {inr(lastNotAccepted.amount)} · UTR {lastNotAccepted.utr}.{" "}
            <PaymentStatusNote payment={lastNotAccepted} />
          </div>
        ) : null}
        {lastApproved ? (
          <div className="mloan-alert success" role="status">
            Your payment of {inr(lastApproved.approvedAmount ?? lastApproved.amount)} was
            successful. {inr(order.amountDue)} is still due on this loan.
          </div>
        ) : null}

        <LoanSummary order={order} />

        <div className="mloan-pay-method">
          <div className="mloan-pay-method-title">Payment Method</div>
          <div className="mloan-order-upi">
            <div>
              <small>UPI ID</small>
              <strong>{upiId}</strong>
            </div>
            <CopyButton value={upiId} label="Copy UPI ID" copiedMessage="UPI ID copied" />
          </div>

          <div className="mloan-or-divider">
            <span>OR</span>
          </div>

          <div className="mloan-payment-qr-card">
            <div className="mloan-payment-label">UPI QR Code</div>
            <div className="mloan-payment-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt={`UPI QR code for ${upiId}`} width={280} height={280} />
            </div>
            <p className="mloan-qr-hint">
              Scan the QR code using your UPI app.
              {useUploadedQr ? ` Enter ${inr(order.amountDue)} as the amount.` : ""}
            </p>
          </div>
        </div>

        <RepaymentForm orderId={order.id} />
      </section>
      {history}
    </AppShell>
  );
}
