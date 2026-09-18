"use client";

import { useState } from "react";

export default function CopyButton({
  value,
  className = "mloan-copy-btn",
  label = "Copy",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? "Copied" : label}
    </button>
  );
}
