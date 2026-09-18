"use client";

import { useActionState } from "react";
import { submitRepaymentAction } from "@/app/actions";
import type { FormState } from "@/lib/form";

const UTR_MESSAGE = "Please enter a valid 12-digit UTR number.";

export default function RepaymentForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitRepaymentAction,
    {},
  );

  return (
    <form action={formAction} encType="multipart/form-data" className="mloan-utr-form">
      <input type="hidden" name="orderId" value={orderId} />

      <label className="mloan-proof-field">
        <span>Enter UTR Number</span>
        <input
          type="text"
          name="utr"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{12}"
          minLength={12}
          maxLength={12}
          placeholder="12-digit UTR, e.g. 402113889077"
          required
          onInput={(e) => {
            const input = e.currentTarget;
            input.value = input.value.replace(/\D/g, "").slice(0, 12);
            input.setCustomValidity("");
          }}
          onInvalid={(e) => e.currentTarget.setCustomValidity(UTR_MESSAGE)}
        />
        <small>
          Enter your 12-digit transaction ID / UTR number after completing the payment.
        </small>
      </label>

      <label className="mloan-proof-field">
        <span>Payment screenshot (optional)</span>
        <input type="file" name="proofImage" accept="image/png,image/jpeg,image/webp" />
        <small>JPG, PNG or WebP up to 4MB. Helps us verify your payment faster.</small>
      </label>

      {state.error ? (
        <div className="mloan-alert mloan-alert-error" role="alert">
          {state.error}
        </div>
      ) : null}

      <button
        className="mloan-btn mloan-btn-primary mloan-btn-block mloan-paid-toggle"
        type="submit"
        disabled={pending}
      >
        {pending ? "Submitting…" : "Submit Payment"}
      </button>
      <p className="mloan-utr-note">
        Your loan is marked paid only after our team verifies the payment.
      </p>
    </form>
  );
}
