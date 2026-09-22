"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/app/actions";
import type { FormState } from "@/lib/form";
import PasswordField from "./PasswordField";

// Access-link setup: the link identifies the account, the mobile number proves
// it belongs to the person using it. Nobody is signed in by this form — after
// setting the password the customer signs in with mobile + password.
export default function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setPasswordAction,
    {},
  );

  return (
    <form className="mloan-login-form" action={formAction}>
      <input type="hidden" name="token" value={token} />
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
          placeholder="Your registered mobile number"
          autoComplete="tel-national"
          minLength={10}
          maxLength={10}
          pattern="[6-9][0-9]{9}"
          required
        />
      </label>

      <PasswordField
        name="password"
        id="setup-password"
        placeholder="New password (minimum 8 characters)"
        autoComplete="new-password"
      />
      <PasswordField
        name="password_confirm"
        id="setup-password-confirm"
        placeholder="Confirm new password"
        autoComplete="new-password"
      />

      <button className="mloan-login-submit" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set password"}
      </button>
      <p className="mloan-login-signup">
        You&apos;ll sign in with your mobile number and this password. Never share it —
        we will never ask for it.
      </p>
    </form>
  );
}
