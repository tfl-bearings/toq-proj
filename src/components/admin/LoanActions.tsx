import Link from "next/link";
import ActionDialog from "./ActionDialog";
import CancelLoanFields from "./CancelLoanFields";
import { cancelLoanAction, deleteLoanAction, markLoanPaidAction } from "@/app/admin/actions";
import { inr, shortDate } from "@/lib/format";
import type { Order } from "@/lib/types";

// Operator actions on a loan itself. They don't need a customer payment/UTR:
// a loan awaiting payment can be edited, marked paid, cancelled or deleted. Once
// the customer submits a UTR, that payment is reviewed on the Payments screen.
export default function LoanActions({
  order,
  pendingPaymentId,
  hasPayments = false,
  returnTo,
  compact = false,
}: {
  order: Pick<Order, "id" | "status" | "productName" | "amountDue" | "dueDate"> & {
    customerName?: string;
  };
  pendingPaymentId?: string;
  hasPayments?: boolean;
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
  const editLink = (
    <Link href={`/admin/orders/${order.id}#edit`} className="adm-btn adm-btn-ghost">
      Edit
    </Link>
  );
  const deleteLoan = (
    <ActionDialog
      action={deleteLoanAction}
      hidden={hidden}
      triggerLabel="Delete"
      triggerClassName="adm-btn adm-btn-delete"
      title="Are you sure you want to delete this loan?"
      description={
        <>
          {summary}. Use this for a loan created by mistake. It disappears from the
          customer&apos;s Pending Loans.
          {hasPayments ? (
            <>
              {" "}
              This loan already has payment records, so it is <b>cancelled and kept</b> for
              history instead of being removed.
            </>
          ) : (
            <> This loan has no payments, so it is removed completely. This can&apos;t be undone.</>
          )}{" "}
          The customer, their login and their other loans are not affected.
        </>
      }
      submitLabel={hasPayments ? "Delete and keep history" : "Delete loan"}
      submitClassName="adm-btn adm-btn-danger"
      pendingLabel="Deleting…"
    />
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
        {editLink}
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
        {deleteLoan}
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
      </div>
    );
  }

  // Cancelled loans can still be removed if they carry no payment records.
  if (order.status === "cancelled" && !hasPayments) {
    return <div className={compact ? "adm-actions adm-actions-compact" : "adm-actions"}>{deleteLoan}</div>;
  }

  return null;
}
