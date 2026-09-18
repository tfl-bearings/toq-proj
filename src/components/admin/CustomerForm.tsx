"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/form";
import { PAYMENT_METHODS } from "@/lib/validation";

type Values = {
  name: string;
  mobile: string;
  email: string;
  upiId: string;
  paymentMethod: string;
};

// Create / edit customer form. Validation runs on the server; the browser
// constraints below are only a convenience.
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
  const [method, setMethod] = useState(initial?.paymentMethod ?? "UPI");

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
        </label>
        <label className="adm-field">
          Email (optional)
          <input name="email" type="email" defaultValue={initial?.email} maxLength={120} />
        </label>
        <label className="adm-field">
          Payment method
          <select
            name="paymentMethod"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          UPI ID {method === "UPI" ? "" : "(optional)"}
          <input
            name="upiId"
            defaultValue={initial?.upiId}
            required={method === "UPI"}
            placeholder="name@bank"
            maxLength={120}
            autoComplete="off"
          />
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
