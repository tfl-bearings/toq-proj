import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import CopyButton from "@/components/CopyButton";
import Countdown from "@/components/Countdown";
import CustomerPayments, {
  PaymentStatusNote,
  PaymentStatusPill,
} from "@/components/CustomerPayments";
import RepaymentForm from "@/components/RepaymentForm";
import { getCurrentCustomer } from "@/lib/session";
import { getOrder, getPaymentsForOrder } from "@/lib/db";
import { inr } from "@/lib/format";
import { NOT_ACCEPTED } from "@/lib/status";
import { upiQrDataUri } from "@/lib/upi";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
          <div className="mloan-payment-result mloan-payment-success">
            <span className="mloan-result-icon mloan-result-success-icon" aria-hidden>
              ✓
            </span>
            <strong>Payment Successful</strong>
            <span>This loan is fully repaid and closed. Thank you.</span>
            <Link
              className="mloan-btn mloan-btn-secondary mloan-result-action"
              href="/orders"
            >
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
          <h2>{order.productName}</h2>
          <p className="mloan-payment-intro">Amount due: {inr(order.amountDue)}</p>
          <div className="mloan-payment-result">
            <span className="mloan-result-icon mloan-review-pending-icon" aria-hidden>
              ⏳
            </span>
            <strong>Payment Pending</strong>
            <span>
              We&apos;ve received your UPI reference and are verifying it against
              our bank records. This is checked by a person — it isn&apos;t
              approved automatically. You&apos;ll see it marked successful once
              confirmed.
            </span>
            {latest ? (
              <div className="mloan-review-utr">
                {inr(latest.amount)} · UTR submitted: <strong>{latest.utr}</strong>
              </div>
            ) : null}
            <Link
              className="mloan-btn mloan-btn-secondary mloan-result-action"
              href="/orders"
            >
              Back to my loans
            </Link>
          </div>
        </section>
        {history}
      </AppShell>
    );
  }

  // Due / overdue — show the outcome of the last attempt, then QR + form -------
  const qr = await upiQrDataUri({
    vpa: order.upiId,
    payeeName: order.payeeName,
    amount: order.amountDue,
    note: `Repayment ${order.id}`,
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

        <h2>Repay {order.productName}</h2>
        <p className="mloan-payment-intro">
          Loan {order.id} · pay the amount below by UPI, then enter your
          transaction reference.
        </p>

        <div className="mloan-payment-qr-card">
          <div className="mloan-payment-label">
            Scan to pay {inr(order.amountDue)}
          </div>
          <div className="mloan-payment-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="UPI QR code to repay this loan" width={280} height={280} />
          </div>
          <div className="mloan-order-upi">
            <div>
              <small>UPI ID</small>
              <strong>{order.upiId}</strong>
            </div>
            <CopyButton value={order.upiId} />
          </div>
        </div>

        <div className="mloan-payment-window">
          <div>
            <small>QR validity</small>
            <strong>This QR stays valid for a few minutes.</strong>
          </div>
          <Countdown seconds={300} />
        </div>
        <p className="mloan-countdown-note">
          If the timer runs out, just refresh this page for a new QR — your loan
          is unaffected.
        </p>

        <RepaymentForm orderId={order.id} amountDue={order.amountDue} today={todayIst()} />
      </section>
      {history}
    </AppShell>
  );
}
