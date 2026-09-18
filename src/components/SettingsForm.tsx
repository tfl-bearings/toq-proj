"use client";

import { useActionState, useState } from "react";
import { updateSettingsAction } from "@/app/admin/actions";
import type { FormState } from "@/lib/form";
import type { Settings } from "@/lib/types";

const PRESETS = [
  { name: "Sky", value: "#66c4ff" },
  { name: "Blue", value: "#027ebb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7a5cff" },
  { name: "Teal", value: "#0f766e" },
  { name: "Green", value: "#17a75a" },
  { name: "Amber", value: "#f7971e" },
  { name: "Rose", value: "#e11d74" },
];

// Same WCAG-based choice the server uses, so the preview matches production.
function readableOn(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const c = hex.replace("#", "");
  const lin = (h: string) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L =
    0.2126 * lin(c.slice(0, 2)) +
    0.7152 * lin(c.slice(2, 4)) +
    0.0722 * lin(c.slice(4, 6));
  return L > 0.5 ? "#0b2a3d" : "#ffffff";
}

export default function SettingsForm({
  settings,
  qrImageUrl,
}: {
  settings: Settings;
  qrImageUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateSettingsAction,
    {},
  );
  const [color, setColor] = useState(settings.themeColor);
  const onColor = readableOn(color);

  return (
    <form action={formAction}>
      {state.error ? <div className="adm-error adm-error-inset">{state.error}</div> : null}
      {state.ok ? <div className="adm-ok adm-error-inset">Settings saved.</div> : null}

      <div className="adm-form-grid">
        <label className="adm-field">
          App name
          <input name="appName" defaultValue={settings.appName} required />
        </label>
        <label className="adm-field">
          Collection UPI ID
          <input
            name="upiId"
            defaultValue={settings.upiId}
            placeholder="name@bank"
            required
            autoComplete="off"
          />
        </label>
        <label className="adm-field">
          Payee name (on UPI)
          <input name="payeeName" defaultValue={settings.payeeName} required />
        </label>
        <label className="adm-field">
          Support email
          <input
            name="supportEmail"
            type="email"
            defaultValue={settings.supportEmail}
          />
        </label>
        <label className="adm-field">
          Support phone
          <input name="supportPhone" defaultValue={settings.supportPhone} />
        </label>
      </div>

      <div className="adm-upi-qr">
        <div className="adm-field">UPI QR code shown to customers</div>
        <div className="adm-upi-qr-row">
          {qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImageUrl} alt="Uploaded UPI QR code" className="adm-upi-qr-preview" />
          ) : (
            <div className="adm-upi-qr-empty">
              Generated automatically from the UPI ID, with the amount due filled in.
            </div>
          )}
          <div className="adm-upi-qr-controls">
            <label className="adm-field">
              {qrImageUrl ? "Replace QR image" : "Upload your bank's UPI QR (optional)"}
              <input type="file" name="upiQrImage" accept="image/png,image/jpeg,image/webp" />
            </label>
            {qrImageUrl ? (
              <label className="adm-check">
                <input type="checkbox" name="removeUpiQr" value="1" /> Remove uploaded QR and use
                the generated one
              </label>
            ) : null}
            <small>JPG, PNG or WebP, up to 1MB. It should encode the UPI ID above.</small>
          </div>
        </div>
      </div>

      <div className="adm-theme">
        <div className="adm-field" style={{ marginBottom: 8 }}>
          Theme color
        </div>
        <div className="adm-swatches">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.value}
              className={
                color.toLowerCase() === p.value.toLowerCase()
                  ? "adm-swatch active"
                  : "adm-swatch"
              }
              style={{ background: p.value }}
              title={p.name}
              aria-label={p.name}
              onClick={() => setColor(p.value)}
            >
              {color.toLowerCase() === p.value.toLowerCase() ? "✓" : ""}
            </button>
          ))}
        </div>

        <div className="adm-theme-row">
          <label className="adm-color-input">
            <input
              type="color"
              name="themeColor"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <span className="adm-mono">{color}</span>
          </label>

          <div
            className="adm-theme-preview"
            style={{ background: color, color: onColor }}
          >
            Aa · Primary button
          </div>
        </div>
      </div>

      <div className="adm-form-foot">
        <button
          type="submit"
          className="adm-btn adm-btn-primary"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
