"use client";

import { useActionState } from "react";
import { submitRepaymentAction } from "@/app/actions";
import type { FormState } from "@/lib/form";

const PAY_APPS = [
  { value: "phonepe", label: "PhonePe", icon: "🟣" },
  { value: "paytm", label: "Paytm", icon: "🔵" },
  { value: "gpay", label: "GPay", icon: "🟢" },
];

export default function RepaymentForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitRepaymentAction,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />

      <fieldset className="mloan-pay-apps branded">
        <legend>Which app did you pay with?</legend>
        {PAY_APPS.map((a) => (
          <label className="mloan-pay-app" key={a.value}>
            <input type="radio" name="payApp" value={a.value} required />
            <span>
              <b>
                {a.icon} {a.label}
              </b>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mloan-payment-proof">
        <label className="mloan-proof-field">
          <span>UPI reference / UTR (12 digits)</span>
          <input
            type="text"
            name="utr"
            inputMode="numeric"
            pattern="[0-9]{12}"
            maxLength={12}
            placeholder="e.g. 402113889077"
            required
          />
          <small>
            You&apos;ll find this in your payment app&apos;s transaction details
            after paying. We verify it against our bank statement — nothing is
            approved automatically.
          </small>
        </label>
      </div>

      {state.error ? (
        <div className="mloan-alert mloan-alert-error">{state.error}</div>
      ) : null}

      <button
        className="mloan-btn mloan-btn-primary mloan-btn-block mloan-paid-toggle"
        type="submit"
        disabled={pending}
      >
        {pending ? "Submitting…" : "I've paid — submit for verification"}
      </button>
    </form>
  );
}
