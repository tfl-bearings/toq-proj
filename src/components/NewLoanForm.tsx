"use client";

import { useActionState } from "react";
import { createLoanAction } from "@/app/admin/actions";
import type { FormState } from "@/lib/form";
import type { Customer, Product } from "@/lib/types";

export default function NewLoanForm({
  customers,
  products,
}: {
  customers: Pick<Customer, "id" | "name" | "mobile">[];
  products: Pick<Product, "id" | "name" | "rateMonthly" | "tenureMonths">[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createLoanAction,
    {},
  );

  return (
    <form action={formAction}>
      {state.error ? <div className="adm-error">{state.error}</div> : null}
      <div className="adm-form-grid">
        <label className="adm-field">
          Customer
          <select name="customerId" defaultValue="" required>
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
          Product
          <select name="productId" defaultValue="" required>
            <option value="" disabled>
              Select a product…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.rateMonthly}%/mo)
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          Loan amount (₹)
          <input type="number" name="amount" min={1} step={500} required />
        </label>
        <label className="adm-field">
          Tenure (months)
          <input type="number" name="tenureMonths" min={1} max={60} required />
        </label>
      </div>
      <div className="adm-form-foot">
        <button
          type="submit"
          className="adm-btn adm-btn-primary"
          disabled={pending}
        >
          {pending ? "Creating…" : "Create loan"}
        </button>
      </div>
    </form>
  );
}
