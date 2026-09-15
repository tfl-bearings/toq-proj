import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import CopyButton from "@/components/CopyButton";
import Countdown from "@/components/Countdown";
import RepaymentForm from "@/components/RepaymentForm";
import { getCurrentCustomer } from "@/lib/session";
import { getOrder, getPaymentsForOrder } from "@/lib/db";
import { inr } from "@/lib/format";
import { upiQrDataUri } from "@/lib/upi";

export default async function RepayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const { orderId } = await params;
  const order = getOrder(orderId);
  if (!order || order.customerId !== customer.id) notFound();

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const payments = getPaymentsForOrder(order.id).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  const latest = payments[0];

  // Paid & closed --------------------------------------------------------------
  if (order.status === "paid") {
    return (
      <AppShell variant="inner" title="Repayment" initial={initial} back="/orders">
        <section className="mloan-payment-page">
          <div className="mloan-payment-result mloan-payment-success">
            <span className="mloan-result-icon mloan-result-success-icon" aria-hidden>
              ✓
            </span>
            <strong>Repayment complete</strong>
            <span>This loan is fully repaid and closed. Thank you.</span>
            <Link
              className="mloan-btn mloan-btn-secondary mloan-result-action"
              href="/orders"
            >
              Back to my loans
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  // Submitted, awaiting manual verification -----------------------------------
  if (order.status === "review") {
    return (
      <AppShell variant="inner" title="Repayment" initial={initial} back="/orders">
        <section className="mloan-payment-page">
          <h2>{order.productName}</h2>
          <p className="mloan-payment-intro">Amount: {inr(order.amountDue)}</p>
          <div className="mloan-payment-result">
            <span className="mloan-result-icon mloan-review-pending-icon" aria-hidden>
              ⏳
            </span>
            <strong>Payment under review</strong>
            <span>
              We&apos;ve received your UPI reference and are verifying it against
              our bank records. This is checked by a person — it isn&apos;t
              approved automatically. You&apos;ll see it marked complete once
              confirmed.
            </span>
            {latest ? (
              <div className="mloan-review-utr">
                UTR submitted: <strong>{latest.utr}</strong>
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
      </AppShell>
    );
  }

  // Due / overdue — show the QR + UPI + proof form ----------------------------
  const qr = await upiQrDataUri({
    vpa: order.upiId,
    payeeName: order.payeeName,
    amount: order.amountDue,
    note: `Repayment ${order.id}`,
  });

  return (
    <AppShell variant="inner" title="Repayment" initial={initial} back="/orders">
      <section className="mloan-payment-page">
        <h2>Repay {order.productName}</h2>
        <p className="mloan-payment-intro">
          Loan {order.id} · pay the exact amount below by UPI, then enter your
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

        <RepaymentForm orderId={order.id} />
      </section>
    </AppShell>
  );
}
