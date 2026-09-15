"use client";

import { useEffect, useState } from "react";

// A plain informational countdown for how long a UPI QR / payment window stays
// valid. When it reaches zero it simply says the window expired and offers a
// refresh — no fake "your loan will be cancelled" pressure.

export default function Countdown({
  seconds,
  className = "mloan-payment-countdown",
  expiredNote = "This payment window has expired. Refresh to get a new QR.",
}: {
  seconds: number;
  className?: string;
  expiredNote?: string;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (remaining <= 0) {
    return <span className={`${className} is-finished`}>{expiredNote}</span>;
  }

  return (
    <span className={className}>
      {mm}:{ss}
    </span>
  );
}
