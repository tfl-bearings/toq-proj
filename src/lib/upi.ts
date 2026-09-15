import QRCode from "qrcode";

// Builds a standard UPI deep link (the same format GPay / PhonePe / Paytm read
// from a scanned QR) and renders it as a PNG data URI for an <img>.

export function buildUpiUri(opts: {
  vpa: string;
  payeeName: string;
  amount: number;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payeeName,
    am: opts.amount.toFixed(2),
    cu: "INR",
  });
  if (opts.note) params.set("tn", opts.note);
  return `upi://pay?${params.toString()}`;
}

export async function upiQrDataUri(opts: {
  vpa: string;
  payeeName: string;
  amount: number;
  note?: string;
}): Promise<string> {
  const uri = buildUpiUri(opts);
  return QRCode.toDataURL(uri, {
    width: 280,
    margin: 1,
    color: { dark: "#17212b", light: "#ffffff" },
  });
}
