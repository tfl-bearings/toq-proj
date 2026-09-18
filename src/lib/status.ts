// Status vocabulary shared by the operator console and the customer app.
// Pure data — safe to import from client components.

import type {
  Customer,
  CustomerStatus,
  PasswordSetupStatus,
  PaymentStatus,
} from "./types";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "approved",
  "rejected",
  "repayment_required",
  "refund_pending",
  "refunded",
];

// Operator-facing labels (upper-case status codes).
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
  repayment_required: "REPAYMENT_REQUIRED",
  refund_pending: "REFUND_PENDING",
  refunded: "REFUNDED",
};

// Customer-facing wording.
export const PAYMENT_CUSTOMER_LABEL: Record<PaymentStatus, string> = {
  pending: "Payment Pending",
  approved: "Payment Successful",
  rejected: "Payment Rejected",
  repayment_required: "Repayment Required",
  refund_pending: "Refund Pending",
  refunded: "Refunded",
};

// Statuses that end a review with the payment NOT accepted.
export const NOT_ACCEPTED: PaymentStatus[] = [
  "rejected",
  "repayment_required",
  "refund_pending",
  "refunded",
];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as string[]).includes(value);
}

export const REJECTION_REASONS = [
  "Invalid UTR",
  "Payment not received",
  "Incorrect payment method",
  "Invalid payment screenshot",
  "Incorrect amount",
  "Duplicate payment",
  "Other",
] as const;

// What happens after a rejection.
export const REJECTION_OUTCOMES: {
  value: Extract<PaymentStatus, "rejected" | "repayment_required" | "refund_pending">;
  label: string;
  hint: string;
}[] = [
  {
    value: "repayment_required",
    label: "Repayment required",
    hint: "Customer is asked to make a new payment.",
  },
  {
    value: "refund_pending",
    label: "Refund money to customer",
    hint: "Money was received but can't be accepted — mark refunded later.",
  },
  {
    value: "rejected",
    label: "Reject only",
    hint: "No follow-up requested. Customer can still pay again.",
  },
];

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  active: "Active",
  pending: "Pending activation",
  inactive: "Deactivated",
};

export const PASSWORD_STATUS_LABEL: Record<PasswordSetupStatus, string> = {
  not_set: "Password Not Set",
  pending: "Pending",
  set: "Password Set",
  activated: "Activated",
};

// not_set   = no password and the access link hasn't been opened
// pending   = link opened, password not yet chosen
// set       = password chosen, but the account is deactivated
// activated = password chosen and the account is active
export function passwordStatus(
  customer: Pick<Customer, "passwordSetAt" | "inviteOpenedAt" | "status">,
): PasswordSetupStatus {
  if (customer.passwordSetAt) {
    return customer.status === "inactive" ? "set" : "activated";
  }
  return customer.inviteOpenedAt ? "pending" : "not_set";
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  customer_created: "Customer created",
  customer_edited: "Customer edited",
  customer_deactivated: "Customer deactivated",
  customer_reactivated: "Customer reactivated",
  customer_deleted: "Customer deleted",
  customer_registered: "Customer self-registered",
  application_link_generated: "Access link generated",
  application_link_opened: "Access link opened",
  password_setup_completed: "Password setup completed",
  payment_submitted: "Payment submitted",
  repayment_submitted: "Repayment submitted",
  payment_approved: "Payment approved",
  payment_rejected: "Payment rejected",
  refund_initiated: "Refund initiated",
  refund_completed: "Refund completed",
  loan_created: "Loan created",
  loan_application_submitted: "Loan application submitted",
  loan_application_approved: "Loan application approved",
  loan_application_rejected: "Loan application rejected",
  settings_updated: "Settings updated",
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action.replace(/_/g, " ");
}
