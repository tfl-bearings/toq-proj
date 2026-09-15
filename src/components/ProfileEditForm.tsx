"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions";
import type { FormState } from "@/lib/form";

export default function ProfileEditForm({
  name,
  email,
  mobile,
}: {
  name: string;
  email: string;
  mobile: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateProfileAction,
    {},
  );

  return (
    <form className="mloan-profile-edit-form" action={formAction}>
      {state.error ? (
        <div className="mloan-alert mloan-alert-error">{state.error}</div>
      ) : null}

      <label>
        Full name
        <input name="name" defaultValue={name} required minLength={2} />
      </label>

      <label>
        Email (optional)
        <input name="email" type="email" defaultValue={email} placeholder="you@example.com" />
      </label>

      <label>
        Mobile number
        <input value={`+91 ${mobile}`} readOnly />
      </label>

      <button
        className="mloan-btn mloan-btn-primary mloan-btn-block"
        type="submit"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
