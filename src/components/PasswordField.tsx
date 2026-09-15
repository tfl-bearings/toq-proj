"use client";

import { useState } from "react";

export default function PasswordField({
  name,
  id,
  placeholder,
  autoComplete = "current-password",
}: {
  name: string;
  id: string;
  placeholder: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="mloan-login-field">
      <span className="mloan-login-field-icon" aria-hidden>
        🔒
      </span>
      <input
        type={show ? "text" : "password"}
        name={name}
        id={id}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={8}
        required
      />
      <button
        type="button"
        className="mloan-login-eye"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
      >
        {show ? "🙈" : "👁"}
      </button>
    </label>
  );
}
