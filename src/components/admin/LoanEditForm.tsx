"use client";

import { useActionState } from "react";
import { editLoanAction } from "@/app/admin/actions";
import type { FormState } from "@/lib/form";

// Edits an existing loan. Saving updates the same loan record; the customer
// sees the new values the next time their app loads.
export default function LoanEditForm({
  orderId,
  productName,
  amount,
  dueDay,
  upiId,
  settingsUpiId,
  returnTo,
}: {
  orderId: string;
  productName: string;
  amount: number;
  dueDay: string;
  upiId: string;
  settingsUpiId: string;
  returnTo: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    editLoanAction,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error ? (
        <div className="adm-error adm-error-inset" role="alert">
          {state.error}
        </div>
      ) : null}
      <div className="adm-form-grid">
        <label className="adm-field">
          Product name
          <input
            name="productName"
            defaultValue={productName}
            required
            minLength={2}
            maxLength={60}
            autoComplete="off"
          />
        </label>
        <label className="adm-field">
          Loan amount (₹)
          <input
            type="number"
            name="amount"
            inputMode="numeric"
            defaultValue={amount}
            min={1}
            step={1}
            required
          />
        </label>
        <label className="adm-field">
          Due date
          <input type="date" name="dueDate" defaultValue={dueDay} required />
        </label>
        <label className="adm-field">
          UPI ID for repayment
          <input
            name="upiId"
            defaultValue={upiId}
            placeholder={settingsUpiId || "name@bank"}
            maxLength={120}
            autoComplete="off"
          />
          <small className="adm-field-hint">
            Leave blank to use the collection UPI from Settings
            {settingsUpiId ? ` (${settingsUpiId})` : ""}. The customer&apos;s UPI ID, copy
            button and QR code all follow this value.
          </small>
        </label>
      </div>
      <div className="adm-form-foot">
        <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
