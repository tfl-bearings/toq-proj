import {
  CUSTOMER_STATUS_LABEL,
  LOAN_STATUS_LABEL,
  PASSWORD_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  passwordStatus,
} from "@/lib/status";
import type { Customer, CustomerStatus, Order, PaymentStatus } from "@/lib/types";
import { isOverdue } from "@/lib/loan";

export function LoanBadge({ order }: { order: Pick<Order, "status" | "dueDate"> }) {
  const status = isOverdue(order) ? "overdue" : order.status;
  return <span className={`adm-badge ${status}`}>{LOAN_STATUS_LABEL[status]}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus | string }) {
  const label = PAYMENT_STATUS_LABEL[status as PaymentStatus] ?? status.toUpperCase();
  return <span className={`adm-badge ${status}`}>{label}</span>;
}

export function CustomerStatusBadge({ status }: { status?: CustomerStatus }) {
  const value = status ?? "pending";
  return <span className={`adm-badge ${value}`}>{CUSTOMER_STATUS_LABEL[value]}</span>;
}

export function PasswordBadge({
  customer,
}: {
  customer: Pick<Customer, "passwordSetAt" | "inviteOpenedAt" | "status">;
}) {
  const value = passwordStatus(customer);
  return (
    <span className={`adm-badge pw-${value}`}>{PASSWORD_STATUS_LABEL[value]}</span>
  );
}
