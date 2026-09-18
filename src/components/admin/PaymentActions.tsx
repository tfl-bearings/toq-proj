import ActionDialog from "./ActionDialog";
import RejectFields from "./RejectFields";
import {
  approvePaymentAction,
  completeRefundAction,
  initiateRefundAction,
  rejectPaymentAction,
} from "@/app/admin/actions";
import { inr } from "@/lib/format";
import type { PaymentRow } from "@/lib/types";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// The review/refund actions valid for a payment in its current status.
export default function PaymentActions({
  payment,
  returnTo,
}: {
  payment: PaymentRow;
  returnTo: string;
}) {
  const hidden = { paymentId: payment.id, returnTo };
  const who = `${payment.customerName ?? "Customer"} · UTR ${payment.utr}`;

  if (payment.status === "pending") {
    return (
      <div className="adm-actions">
        <ActionDialog
          action={approvePaymentAction}
          hidden={hidden}
          triggerLabel="Approve"
          triggerClassName="adm-btn adm-btn-approve"
          title="Approve payment?"
          description={
            <>
              Confirm you found <b>{inr(payment.amount)}</b> with UTR{" "}
              <b className="adm-mono">{payment.utr}</b> in the bank statement. {who}.
              The loan balance is reduced by the verified amount and the customer
              sees <b>Payment Successful</b>.
            </>
          }
          submitLabel="Approve payment"
          submitClassName="adm-btn adm-btn-approve"
          pendingLabel="Approving…"
        >
          <label className="adm-field">
            Verified amount (₹)
            <input
              type="number"
              name="approvedAmount"
              defaultValue={payment.amount}
              min={1}
              max={Math.max(payment.amount, payment.amountDueAtSubmission ?? 0)}
              step={1}
              required
            />
          </label>
          <label className="adm-field">
            Note (optional, internal)
            <input name="note" maxLength={300} placeholder="e.g. Matched in HDFC statement" />
          </label>
        </ActionDialog>
        <ActionDialog
          action={rejectPaymentAction}
          hidden={hidden}
          triggerLabel="Reject"
          triggerClassName="adm-btn adm-btn-reject"
          title="Reject payment"
          description={<>{inr(payment.amount)} · {who}. The customer sees the reason.</>}
          submitLabel="Reject payment"
          submitClassName="adm-btn adm-btn-danger"
          pendingLabel="Rejecting…"
        >
          <RejectFields />
        </ActionDialog>
      </div>
    );
  }

  if (payment.status === "rejected" || payment.status === "repayment_required") {
    return (
      <div className="adm-actions">
        <ActionDialog
          action={initiateRefundAction}
          hidden={hidden}
          triggerLabel="Initiate refund"
          triggerClassName="adm-btn adm-btn-secondary"
          title="Initiate refund?"
          description={
            <>
              Use this if the money for this rejected payment reached you and must be
              returned. Status becomes <b>REFUND_PENDING</b>.
            </>
          }
          submitLabel="Initiate refund"
          pendingLabel="Saving…"
        >
          <label className="adm-field">
            Note (optional)
            <input name="note" maxLength={300} />
          </label>
        </ActionDialog>
      </div>
    );
  }

  if (payment.status === "refund_pending") {
    return (
      <div className="adm-actions">
        <ActionDialog
          action={completeRefundAction}
          hidden={hidden}
          triggerLabel="Mark refunded"
          triggerClassName="adm-btn adm-btn-approve"
          title="Record completed refund"
          description={<>Refund {inr(payment.amount)} to {payment.customerName ?? "the customer"}.</>}
          submitLabel="Mark as refunded"
          submitClassName="adm-btn adm-btn-approve"
        >
          <label className="adm-field">
            Refund UTR / reference
            <input
              name="refundReference"
              required
              minLength={6}
              maxLength={40}
              pattern="[A-Za-z0-9\-]{6,40}"
              className="adm-mono"
            />
          </label>
          <label className="adm-field">
            Refund date
            <input type="date" name="refundDate" defaultValue={todayIst()} max={todayIst()} required />
          </label>
          <label className="adm-field">
            Note (optional)
            <input name="note" maxLength={300} />
          </label>
        </ActionDialog>
      </div>
    );
  }

  return null;
}
