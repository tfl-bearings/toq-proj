"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setupAccountAction } from "@/app/actions";
import type { FormState } from "@/lib/form";
import PasswordField from "./PasswordField";

export default function SetupAccountForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setupAccountAction,
    {},
  );

  return (
    <form className="mloan-login-form" action={formAction}>
      {state.error ? (
        <div className="mloan-alert mloan-alert-error" role="alert">
          {state.error}
        </div>
      ) : null}

      <label className="mloan-login-field mloan-mobile-field">
        <span className="mloan-login-field-icon" aria-hidden>
          👤
        </span>
        <span className="mloan-country-prefix">+91</span>
        <input
          type="tel"
          inputMode="numeric"
          name="mobile"
          placeholder="10-digit mobile number"
          autoComplete="tel-national"
          minLength={10}
          maxLength={10}
          pattern="[6-9][0-9]{9}"
          required
        />
      </label>

      <label className="mloan-login-field">
        <span className="mloan-login-field-icon" aria-hidden>
          🔑
        </span>
        <input
          type="text"
          inputMode="numeric"
          name="activationCode"
          placeholder="8-digit activation code"
          autoComplete="one-time-code"
          pattern="[0-9]{8}"
          minLength={8}
          maxLength={8}
          required
          onInput={(e) => {
            e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 8);
          }}
        />
      </label>

      <PasswordField
        name="password"
        id="setup-new-password"
        placeholder="New password (minimum 8 characters)"
        autoComplete="new-password"
      />
      <PasswordField
        name="password_confirm"
        id="setup-new-password-confirm"
        placeholder="Confirm new password"
        autoComplete="new-password"
      />

      <button className="mloan-login-submit" type="submit" disabled={pending}>
        {pending ? "Please wait…" : "Set password"}
      </button>
      <p className="mloan-login-signup">
        Already set up? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
