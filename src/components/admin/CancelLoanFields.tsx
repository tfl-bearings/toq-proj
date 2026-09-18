"use client";

import { useState } from "react";
import { LOAN_CANCEL_REASONS } from "@/lib/status";

// Reason picker for cancelling a loan; "Other" requires an explanation.
export default function CancelLoanFields() {
  const [reason, setReason] = useState("");
  const isOther = reason === "Other";
  return (
    <>
      <label className="adm-field">
        Reason
        <select
          name="cancelReason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {LOAN_CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="adm-field">
        {isOther ? "Describe the reason (required)" : "Explanation for the customer (optional)"}
        <textarea
          name="customReason"
          rows={3}
          maxLength={300}
          required={isOther}
          minLength={isOther ? 3 : undefined}
        />
      </label>
    </>
  );
}
