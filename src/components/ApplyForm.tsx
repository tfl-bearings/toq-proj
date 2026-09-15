"use client";

import { useActionState, useState } from "react";
import { applyForLoanAction } from "@/app/actions";
import type { FormState } from "@/lib/form";
import type { Product } from "@/lib/types";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ApplyForm({ product }: { product: Product }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    applyForLoanAction,
    {},
  );
  const [amount, setAmount] = useState(product.min);
  const [tenure, setTenure] = useState(product.tenureMonths);

  const estimate = Math.round(
    amount * (1 + (product.rateMonthly / 100) * tenure),
  );

  return (
    <form className="mloan-repayment-form" action={formAction}>
      <input type="hidden" name="productId" value={product.id} />

      {state.error ? (
        <div className="mloan-alert mloan-alert-error">{state.error}</div>
      ) : null}

      <label>
        Loan amount ({inr(product.min)} – {inr(product.max)})
        <input
          type="number"
          name="amount"
          min={product.min}
          max={product.max}
          step={500}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          required
        />
      </label>

      <label>
        Tenure (months)
        <input
          type="number"
          name="tenureMonths"
          min={1}
          max={60}
          value={tenure}
          onChange={(e) => setTenure(Number(e.target.value))}
          required
        />
      </label>

      <label>
        Purpose (optional)
        <input
          type="text"
          name="purpose"
          placeholder="e.g. medical, education, business"
        />
      </label>

      <div className="mloan-payment-complete">
        <strong>Estimated total repayable: {inr(estimate)}</strong>
        <span>
          {inr(amount)} over {tenure} month{tenure > 1 ? "s" : ""} at{" "}
          {product.rateMonthly}% / month (indicative — final terms are confirmed
          on approval).
        </span>
      </div>

      <button
        className="mloan-btn mloan-btn-primary mloan-btn-block"
        type="submit"
        disabled={pending}
        style={{ marginTop: 14 }}
      >
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
