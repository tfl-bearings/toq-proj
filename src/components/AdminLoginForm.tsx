"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/app/admin/actions";
import type { FormState } from "@/lib/form";

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    adminLoginAction,
    {},
  );

  return (
    <form action={formAction}>
      {state.error ? <div className="adm-error">{state.error}</div> : null}
      <label className="adm-field">
        Username
        <input name="username" autoComplete="username" required />
      </label>
      <label className="adm-field">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="adm-submit" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
