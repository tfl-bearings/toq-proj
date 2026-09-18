import Link from "next/link";
import ActionDialog from "./ActionDialog";
import CancelLoanFields from "./CancelLoanFields";
import {
  cancelLoanAction,
  keepLoanPendingAction,
  markLoanPaidAction,
} from "@/app/admin/actions";
import { inr, shortDate } from "@/lib/format";
import type { Order } from "@/lib/types";

// Operator actions on a loan itself. They don't need a customer payment/UTR:
// a loan awaiting payment can be marked paid, cancelled or left pending. Once
// the customer submits a UTR, that payment is reviewed on the Payments screen.
export default function LoanActions({
  order,
  pendingPaymentId,
  returnTo,
  compact = false,
}: {
  order: Pick<Order, "id" | "status" | "productName" | "amountDue" | "dueDate"> & {
    customerName?: string;
  };
  pendingPaymentId?: string;
  returnTo: string;
  compact?: boolean;
}) {
  const hidden = { orderId: order.id, returnTo };
  const summary = (
    <>
      <b>{order.productName}</b> · {inr(order.amountDue)} · due {shortDate(order.dueDate)}
      {order.customerName ? <> · {order.customerName}</> : null}
    </>
  );
  const keepPending = (
    <ActionDialog
      action={keepLoanPendingAction}
      hidden={hidden}
      triggerLabel="Keep Pending"
      triggerClassName="adm-btn adm-btn-ghost"
      title="Keep this loan pending?"
      description={
        <>
          {summary}. Nothing changes: the loan stays{" "}
          {order.status === "review" ? "with its payment under review" : "awaiting payment"} and
          visible to the customer. Your review is recorded in the activity log.
        </>
      }
      submitLabel="Keep pending"
    >
      <label className="adm-field">
        Note (optional, internal)
        <input name="note" maxLength={300} placeholder="e.g. Customer promised to pay Friday" />
      </label>
    </ActionDialog>
  );

  if (order.status === "due" || order.status === "overdue") {
    return (
      <div className={compact ? "adm-actions adm-actions-compact" : "adm-actions"}>
        <ActionDialog
          action={markLoanPaidAction}
          hidden={hidden}
          triggerLabel="Mark Paid"
          triggerClassName="adm-btn adm-btn-approve"
          title="Mark this loan as paid?"
          description={
            <>
              {summary}. Use this when you&apos;ve confirmed the money yourself (cash,
              bank transfer…). The loan closes as <b>PAID</b> without a UTR — no payment
              record or UTR is created — and the customer is notified.
            </>
          }
          submitLabel="Mark as paid"
          submitClassName="adm-btn adm-btn-approve"
        >
          <label className="adm-field">
            Note (optional)
            <input name="note" maxLength={300} placeholder="e.g. Received in cash at branch" />
          </label>
        </ActionDialog>
        <ActionDialog
          action={cancelLoanAction}
          hidden={hidden}
          triggerLabel="Cancel Loan"
          triggerClassName="adm-btn adm-btn-reject"
          title="Cancel this loan?"
          description={
            <>
              {summary}. The loan closes as <b>CANCELLED</b>, leaves the customer&apos;s
              dues and can no longer be paid. The customer sees the reason.
            </>
          }
          submitLabel="Cancel loan"
          submitClassName="adm-btn adm-btn-danger"
        >
          <CancelLoanFields />
        </ActionDialog>
        {keepPending}
      </div>
    );
  }

  if (order.status === "review") {
    return (
      <div className={compact ? "adm-actions adm-actions-compact" : "adm-actions"}>
        {pendingPaymentId ? (
          <Link href={`/admin/payments/${pendingPaymentId}`} className="adm-btn adm-btn-primary">
            Review payment
          </Link>
        ) : null}
        {keepPending}
      </div>
    );
  }

  return null;
}
