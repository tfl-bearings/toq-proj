"use client";

import { useState } from "react";
import { REJECTION_OUTCOMES, REJECTION_REASONS } from "@/lib/status";

// Fields for the reject-payment modal: a reason, an optional explanation that
// is shown to the customer, and what the customer should do next.
export default function RejectFields() {
  const [reason, setReason] = useState<string>("");
  const isOther = reason === "Other";

  return (
    <>
      <label className="adm-field">
        Reason
        <select
          name="rejectReason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {REJECTION_REASONS.map((r) => (
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
          placeholder="e.g. Screenshot shows ₹1,000 but ₹2,599 is due."
        />
      </label>
      <fieldset className="adm-radio-group">
        <legend>What happens next?</legend>
        {REJECTION_OUTCOMES.map((o, i) => (
          <label key={o.value} className="adm-radio">
            <input type="radio" name="outcome" value={o.value} defaultChecked={i === 0} />
            <span>
              <b>{o.label}</b>
              <small>{o.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
    </>
  );
}
