"use client";

import { useActionState } from "react";
import { createLoanAction } from "@/app/admin/actions";
import type { FormState } from "@/lib/form";
import type { Customer } from "@/lib/types";

export default function NewLoanForm({
  customers,
  defaultCustomerId,
  defaultUpiId,
  today,
}: {
  customers: Pick<Customer, "id" | "name" | "mobile">[];
  defaultCustomerId?: string;
  defaultUpiId: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createLoanAction,
    {},
  );

  return (
    <form action={formAction}>
      {state.error ? (
        <div className="adm-error adm-error-inset" role="alert">
          {state.error}
        </div>
      ) : null}
      <div className="adm-form-grid">
        <label className="adm-field">
          Customer
          <select name="customerId" defaultValue={defaultCustomerId ?? ""} required>
            <option value="" disabled>
              Select a customer…
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (+91 {c.mobile})
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          Product name
          <input
            name="productName"
            placeholder="e.g. Quick Rupee"
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
            min={1}
            step={1}
            placeholder="e.g. 500"
            required
          />
        </label>
        <label className="adm-field">
          Due date
          <input type="date" name="dueDate" min={today} required />
        </label>
        <label className="adm-field">
          UPI ID for repayment (optional)
          <input
            name="upiId"
            placeholder={defaultUpiId || "name@bank"}
            maxLength={120}
            autoComplete="off"
          />
          <small className="adm-field-hint">
            Leave blank to use the collection UPI from Settings
            {defaultUpiId ? ` (${defaultUpiId})` : ""}.
          </small>
        </label>
      </div>
      <div className="adm-form-foot">
        <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create loan"}
        </button>
      </div>
    </form>
  );
}
