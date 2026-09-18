"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/app/actions";
import type { FormState } from "@/lib/form";
import PasswordField from "./PasswordField";

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
        {pending ? "Saving…" : "Set password & continue"}
      </button>
      <p className="mloan-login-signup">
        Never share your password. We will never ask for it.
      </p>
    </form>
  );
}
