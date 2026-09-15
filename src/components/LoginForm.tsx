"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import type { FormState } from "@/lib/form";
import PasswordField from "./PasswordField";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  );

  return (
    <form className="mloan-login-form" action={formAction}>
      {state.error ? (
        <div className="mloan-alert mloan-alert-error">{state.error}</div>
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
        <span className="mloan-login-field-end" aria-hidden>
          📱
        </span>
      </label>

      <PasswordField
        name="password"
        id="login-password"
        placeholder="Password (minimum 8 characters)"
      />
      <PasswordField
        name="password_confirm"
        id="login-password-confirm"
        placeholder="Confirm Password"
      />

      <div className="mloan-login-row">
        <label className="mloan-remember">
          <input type="checkbox" name="remember" value="1" defaultChecked />
          <span>Remember Me</span>
        </label>
      </div>

      <button className="mloan-login-submit" type="submit" disabled={pending}>
        {pending ? "Please wait…" : "Login / Register"}
      </button>

      <p className="mloan-login-signup">
        New here? Signing in with a new number creates your account.
      </p>
    </form>
  );
}
