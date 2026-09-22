"use client";

import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";

// Copy / share controls for a customer's personal access link.
export default function ShareLink({
  url,
  mobile,
  email,
  customerName,
  appName,
}: {
  url: string;
  mobile: string;
  email?: string;
  customerName: string;
  appName: string;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);

  const text = `Hi ${customerName}, set your ${appName} password here: ${url} — open it and enter your mobile number.`;
  const encoded = encodeURIComponent(text);

  return (
    <div className="adm-share">
      <div className="adm-share-url">
        <input value={url} readOnly aria-label="Access link" onFocus={(e) => e.target.select()} />
        <CopyButton value={url} className="adm-btn adm-btn-primary" label="Copy link" />
      </div>
      <div className="adm-actions">
        <a
          className="adm-btn adm-btn-ghost"
          href={`https://wa.me/91${mobile}?text=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        <a className="adm-btn adm-btn-ghost" href={`sms:+91${mobile}?body=${encoded}`}>
          SMS
        </a>
        {email ? (
          <a
            className="adm-btn adm-btn-ghost"
            href={`mailto:${email}?subject=${encodeURIComponent(`Set up your ${appName} account`)}&body=${encoded}`}
          >
            Email
          </a>
        ) : null}
        {canShare ? (
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => navigator.share({ title: appName, text, url }).catch(() => {})}
          >
            Share…
          </button>
        ) : null}
      </div>
    </div>
  );
}
