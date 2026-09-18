import Link from "next/link";
import { inr, shortDate } from "@/lib/format";
import { PAYMENT_CUSTOMER_LABEL } from "@/lib/status";
import type { Payment, PaymentStatus } from "@/lib/types";

type Item = Pick<
  Payment,
  | "id"
  | "orderId"
  | "amount"
  | "approvedAmount"
  | "utr"
  | "status"
  | "createdAt"
  | "paymentDate"
  | "reason"
  | "reviewNote"
  | "reviewedAt"
  | "refundReference"
  | "refundedAt"
> & { productName?: string };

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  return (
    <span className={`mloan-pay-status ps-${status}`}>{PAYMENT_CUSTOMER_LABEL[status]}</span>
  );
}

// What the customer should know / do for a payment's current status.
export function PaymentStatusNote({ payment }: { payment: Item }) {
  switch (payment.status) {
    case "pending":
      return <>We&apos;re verifying this payment against our bank records.</>;
    case "approved":
      return (
        <>
          Confirmed{payment.reviewedAt ? ` on ${shortDate(payment.reviewedAt)}` : ""}.
          {payment.approvedAmount && payment.approvedAmount !== payment.amount
            ? ` Verified amount: ${inr(payment.approvedAmount)}.`
            : ""}
        </>
      );
    case "rejected":
      return (
        <>
          Not accepted: {payment.reason}.{payment.reviewNote ? ` ${payment.reviewNote}` : ""} You
          can submit a new payment for this loan.
        </>
      );
    case "repayment_required":
      return (
        <>
          Not accepted: {payment.reason}.{payment.reviewNote ? ` ${payment.reviewNote}` : ""}{" "}
          <b>Please make a new payment</b> for this loan.
        </>
      );
    case "refund_pending":
      return (
        <>
          Not accepted: {payment.reason}.{payment.reviewNote ? ` ${payment.reviewNote}` : ""} This
          amount will be refunded to you.
        </>
      );
    case "refunded":
      return (
        <>
          Refunded{payment.refundedAt ? ` on ${shortDate(payment.refundedAt)}` : ""}
          {payment.refundReference ? ` · refund reference ${payment.refundReference}` : ""}.
        </>
      );
  }
}

export default function CustomerPayments({
  payments,
  showLoan = false,
}: {
  payments: Item[];
  showLoan?: boolean;
}) {
  if (payments.length === 0) {
    return <div className="mloan-empty-state">No payments yet.</div>;
  }
  return (
    <ul className="mloan-payment-history">
      {payments.map((p) => (
        <li key={p.id}>
          <div className="mloan-payment-history-head">
            <b>{inr(p.amount)}</b>
            <PaymentStatusPill status={p.status} />
          </div>
          <div className="mloan-payment-history-meta">
            {showLoan && p.productName ? (
              <>
                <Link href={`/repay/${p.orderId}`}>{p.productName}</Link> ·{" "}
              </>
            ) : null}
            UTR {p.utr} · {shortDate(p.paymentDate ?? p.createdAt)}
          </div>
          <p>
            <PaymentStatusNote payment={p} />
          </p>
          <small>Transaction ID {p.id}</small>
        </li>
      ))}
    </ul>
  );
}
