"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form";

type Values = {
  name: string;
  mobile: string;
};

// Create / edit customer. A customer record only needs a name and the mobile
// number they sign in with; UPI and payment details belong to each loan.
export default function CustomerForm({
  action,
  customerId,
  initial,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  customerId?: string;
  initial?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}
      {state.error ? (
        <div className="adm-error adm-error-inset" role="alert">
          {state.error}
        </div>
      ) : null}
      <div className="adm-form-grid">
        <label className="adm-field">
          Customer name
          <input
            name="name"
            defaultValue={initial?.name}
            required
            minLength={2}
            maxLength={80}
            autoComplete="off"
          />
        </label>
        <label className="adm-field">
          Mobile number
          <input
            name="mobile"
            type="tel"
            inputMode="numeric"
            defaultValue={initial?.mobile}
            required
            placeholder="10 digits, e.g. 9876543210"
            maxLength={16}
            autoComplete="off"
          />
          <small className="adm-field-hint">The number the customer signs in with.</small>
        </label>
      </div>
      <div className="adm-form-foot">
        <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
