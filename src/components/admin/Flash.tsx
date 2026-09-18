"use client";

import { useEffect, useState } from "react";

const MESSAGES: Record<string, string> = {
  created: "Customer created. Share the access link below so they can set a password.",
  saved: "Customer details saved.",
  deactivated: "Customer deactivated and signed out of all sessions.",
  reactivated: "Customer reactivated.",
  deleted: "Customer deleted.",
  link: "New access link generated. Any previous link no longer works.",
  approved: "Payment approved. The customer now sees it as successful.",
  rejected: "Payment rejected. The customer has been notified with the reason.",
  refund_started: "Refund initiated. Mark it refunded once the money is sent.",
  refunded: "Refund recorded. The customer has been notified.",
  loan_created: "Loan created and the customer has been notified.",
};

// One-shot success banner driven by ?notice=<code>. The code is removed from
// the URL so a refresh doesn't repeat it.
export default function Flash({ notice }: { notice?: string }) {
  const [visible, setVisible] = useState(Boolean(notice && MESSAGES[notice]));

  useEffect(() => {
    setVisible(Boolean(notice && MESSAGES[notice]));
    if (!notice) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [notice]);

  if (!visible || !notice) return null;
  return (
    <div className="adm-flash" role="status">
      <span>✓ {MESSAGES[notice]}</span>
      <button type="button" aria-label="Dismiss" onClick={() => setVisible(false)}>
        ×
      </button>
    </div>
  );
}
