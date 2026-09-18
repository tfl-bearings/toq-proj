"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/lib/form";

// A button that opens a modal form bound to a Server Action. Validation errors
// from the server stay inside the modal; on success the action redirects (with
// a ?notice=) and the modal closes.
export default function ActionDialog({
  action,
  hidden,
  triggerLabel,
  triggerClassName = "adm-btn adm-btn-primary",
  title,
  description,
  submitLabel,
  submitClassName = "adm-btn adm-btn-primary",
  pendingLabel = "Saving…",
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  submitClassName?: string;
  pendingLabel?: string;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittedWith = useRef<FormState | null>(null);

  useEffect(() => {
    if (pending) {
      submittedWith.current = state;
      return;
    }
    if (submittedWith.current === null) return;
    const freshError = state !== submittedWith.current && state.error;
    submittedWith.current = null;
    if (!freshError) dialogRef.current?.close();
  }, [pending, state]);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog ref={dialogRef} className="adm-dialog" aria-label={title}>
        <form action={formAction} className="adm-dialog-body">
          <div className="adm-dialog-head">
            <h3>{title}</h3>
            <button
              type="button"
              className="adm-dialog-close"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </div>
          {description ? <div className="adm-dialog-desc">{description}</div> : null}
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {children}
          {state.error && state !== submittedWith.current ? (
            <div className="adm-error" role="alert">
              {state.error}
            </div>
          ) : null}
          <div className="adm-dialog-foot">
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
            >
              Cancel
            </button>
            <button type="submit" className={submitClassName} disabled={pending}>
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
