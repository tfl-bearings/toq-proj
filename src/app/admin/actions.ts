"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { newToken, verifyPassword } from "@/lib/auth";
import {
  approvePayment,
  cancelLoan,
  clearUpiQrImage,
  completeRefund,
  createAdminSession,
  createAuditLog,
  createCustomer,
  createNotification,
  createOrder,
  customerHasRecords,
  decideApplication,
  deleteAdminSession,
  deleteCustomerIfUnused,
  deleteSessionsForCustomer,
  DuplicateMobileError,
  getAdminByUsername,
  getApplication,
  getCustomerById,
  getCustomerByMobile,
  getOrder,
  getPayment,
  getProduct,
  initiateRefund,
  markLoanPaid,
  rejectPayment,
  rotateCustomerInvite,
  setUpiQrImage,
  updateApplication,
  updateCustomer,
  updateSettings,
} from "@/lib/db";
import { addMonthsIso, dueDateFromDay, todayIst, totalRepayable } from "@/lib/loan";
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  getCurrentAdmin,
  setAdminSessionCookie,
} from "@/lib/session";
import { dateTime, inr, shortDate } from "@/lib/format";
import { LOAN_CANCEL_REASONS, REJECTION_OUTCOMES, REJECTION_REASONS } from "@/lib/status";
import { field, UPI_RE, validateCustomerFields } from "@/lib/validation";
import { sniffImage } from "@/lib/proof";
import type { FormState } from "@/lib/form";
import type { Admin, Customer } from "@/lib/types";

const UPI_QR_MAX_BYTES = 1024 * 1024;

async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

// Only operator-console paths are accepted as a post-action destination.
function returnTo(formData: FormData, fallback: string): string {
  const target = field(formData, "returnTo");
  return /^\/admin(\/|\?|$)/.test(target) && !target.startsWith("//")
    ? target
    : fallback;
}

function withNotice(path: string, notice: string): string {
  const [base, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("notice", notice);
  return `${base}?${params.toString()}`;
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

// --- Auth --------------------------------------------------------------------

export async function adminLoginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const username = field(formData, "username");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Enter your username and password." };
  }

  const admin = await getAdminByUsername(username);
  if (
    !admin ||
    !verifyPassword(password, admin.passwordHash, admin.passwordSalt)
  ) {
    return { error: "Invalid username or password." };
  }

  const token = newToken();
  await createAdminSession(token, admin.id);
  await setAdminSessionCookie(token, admin.id);
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value.split(".")[0];
  if (token) await deleteAdminSession(token);
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

// --- Customers ---------------------------------------------------------------

// Accepts "98765 43210", "+91 98765-43210" etc.; stores the bare 10 digits.
function normalizeMobile(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "");
  const match = compact.match(/^(?:\+?91)?([0-9]{10})$/);
  return match ? match[1] : compact;
}

function readCustomerFields(formData: FormData) {
  return {
    name: field(formData, "name"),
    mobile: normalizeMobile(field(formData, "mobile")),
    email: field(formData, "email").toLowerCase(),
    upiId: field(formData, "upiId"),
    paymentMethod: field(formData, "paymentMethod") || "UPI",
  };
}

export async function createCustomerAdminAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const input = readCustomerFields(formData);
  const invalid = validateCustomerFields(input);
  if (invalid) return { error: invalid };
  if (await getCustomerByMobile(input.mobile)) {
    return { error: "A customer with this mobile number already exists." };
  }

  let customer: Customer;
  try {
    customer = await createCustomer({ ...input, createdBy: admin.id });
  } catch (error) {
    if (error instanceof DuplicateMobileError) return { error: error.message };
    throw error;
  }

  await createAuditLog({
    action: "customer_created",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: customer.id,
    details: `Created ${customer.name} (${customer.customerCode}, +91 ${customer.mobile})`,
  });
  await createAuditLog({
    action: "application_link_generated",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: customer.id,
    details: `Access link issued, valid until ${dateTime(customer.inviteExpiresAt)}`,
  });
  await createNotification({
    customerId: customer.id,
    kind: "account_created",
    title: "Your account was created",
    message: "Welcome! Your account has been set up. You can now repay your loans securely.",
  });

  revalidateAdmin();
  redirect(`/admin/customers/${customer.id}?notice=created`);
}

export async function updateCustomerAdminAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const customerId = field(formData, "customerId");
  const customer = await getCustomerById(customerId);
  if (!customer) return { error: "Customer not found." };

  const input = readCustomerFields(formData);
  const invalid = validateCustomerFields(input);
  if (invalid) return { error: invalid };
  const owner = await getCustomerByMobile(input.mobile);
  if (owner && owner.id !== customer.id) {
    return { error: "Another customer already uses this mobile number." };
  }

  const changed = (Object.keys(input) as (keyof typeof input)[]).filter(
    (key) => (customer[key] ?? "") !== input[key],
  );
  if (changed.length === 0) {
    return { error: "Nothing changed." };
  }

  try {
    await updateCustomer(customerId, input);
  } catch (error) {
    if (error instanceof DuplicateMobileError) {
      return { error: "Another customer already uses this mobile number." };
    }
    throw error;
  }
  await createAuditLog({
    action: "customer_edited",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId,
    details: changed
      .map((key) => `${key}: “${customer[key] ?? ""}” → “${input[key]}”`)
      .join("; "),
  });

  revalidateAdmin();
  redirect(`/admin/customers/${customerId}?notice=saved`);
}

export async function deactivateCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const customerId = field(formData, "customerId");
  const reason = field(formData, "reason").slice(0, 300);
  const customer = await getCustomerById(customerId);
  if (!customer) return { error: "Customer not found." };
  if (customer.status === "inactive") return { error: "Customer is already deactivated." };

  await updateCustomer(customerId, {
    status: "inactive",
    deactivatedAt: new Date().toISOString(),
  });
  // Sign the customer out everywhere.
  await deleteSessionsForCustomer(customerId);
  await createAuditLog({
    action: "customer_deactivated",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId,
    reason: reason || undefined,
    details: `Deactivated ${customer.name}; active sessions revoked`,
  });

  revalidateAdmin();
  redirect(`/admin/customers/${customerId}?notice=deactivated`);
}

export async function reactivateCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const customerId = field(formData, "customerId");
  const customer = await getCustomerById(customerId);
  if (!customer) return { error: "Customer not found." };
  if (customer.status !== "inactive") return { error: "Customer is not deactivated." };

  const status = customer.passwordSetAt ? "active" : "pending";
  await updateCustomer(customerId, { status }, ["deactivatedAt"]);
  await createAuditLog({
    action: "customer_reactivated",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId,
    details: `Reactivated ${customer.name} as ${status}`,
  });

  revalidateAdmin();
  redirect(`/admin/customers/${customerId}?notice=reactivated`);
}

export async function deleteCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  if (admin.role !== "owner") {
    return { error: "Only the owner can permanently delete customers." };
  }
  const customerId = field(formData, "customerId");
  const customer = await getCustomerById(customerId);
  if (!customer) return { error: "Customer not found." };
  if (await customerHasRecords(customerId)) {
    return {
      error:
        "This customer has loans, applications or payments, so their history must be kept. Deactivate them instead.",
    };
  }
  if (!(await deleteCustomerIfUnused(customerId))) {
    return { error: "The customer now has records and can't be deleted. Deactivate instead." };
  }
  await createAuditLog({
    action: "customer_deleted",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId,
    details: `Deleted ${customer.name} (${customer.customerCode ?? customer.id}, +91 ${customer.mobile})`,
  });

  revalidateAdmin();
  redirect("/admin/customers?notice=deleted");
}

export async function generateCustomerInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const customerId = field(formData, "customerId");
  const customer = await getCustomerById(customerId);
  if (!customer) return { error: "Customer not found." };
  if (customer.status === "inactive") {
    return { error: "Reactivate the customer before issuing an access link." };
  }

  const updated = await rotateCustomerInvite(customerId);
  await createAuditLog({
    action: "application_link_generated",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId,
    details: `${customer.inviteToken ? "Replaced previous access link" : customer.passwordSetAt ? "Password reset link issued" : "Access link issued"}, valid until ${dateTime(updated?.inviteExpiresAt)}`,
  });

  revalidateAdmin();
  redirect(`/admin/customers/${customerId}?notice=link`);
}

// --- Payment review (the core operator task) --------------------------------

export async function approvePaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const paymentId = field(formData, "paymentId");
  const note = field(formData, "note").slice(0, 300);
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "pending") {
    return { error: `Already reviewed (${payment.status}) by ${payment.reviewedByName ?? "another operator"}.` };
  }

  const order = await getOrder(payment.orderId);
  const maxAmount = Math.max(payment.amount, order?.amountDue ?? 0);
  const rawAmount = field(formData, "approvedAmount");
  const approvedAmount = rawAmount ? Number(rawAmount) : payment.amount;
  if (!Number.isInteger(approvedAmount) || approvedAmount < 1 || approvedAmount > maxAmount) {
    return { error: `Verified amount must be a whole number between ₹1 and ${inr(maxAmount)}.` };
  }

  const approved = await approvePayment({
    paymentId,
    reviewer: admin,
    approvedAmount,
    note: note || undefined,
  });
  if (!approved) {
    return { error: "This payment was reviewed by someone else a moment ago. Refresh to see it." };
  }
  const updatedOrder = await getOrder(payment.orderId);
  const closed = updatedOrder?.status === "paid";

  await createAuditLog({
    action: "payment_approved",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: payment.customerId,
    paymentId,
    orderId: payment.orderId,
    details: `Approved ${inr(approvedAmount)}${approvedAmount !== payment.amount ? ` (submitted ${inr(payment.amount)})` : ""} · UTR ${payment.utr}${closed ? " · loan closed" : ` · ${inr(updatedOrder?.amountDue ?? 0)} still due`}`,
  });
  await createNotification({
    customerId: payment.customerId,
    kind: "payment_approved",
    title: "Payment successful",
    message: closed
      ? `Your payment of ${inr(approvedAmount)} is confirmed and your ${payment.productName ?? "loan"} is fully repaid.`
      : `Your payment of ${inr(approvedAmount)} is confirmed. ${inr(updatedOrder?.amountDue ?? 0)} remains due.`,
    paymentId,
    orderId: payment.orderId,
  });

  revalidateAdmin();
  redirect(withNotice(returnTo(formData, "/admin/payments"), "approved"));
}

export async function rejectPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const paymentId = field(formData, "paymentId");
  const choice = field(formData, "rejectReason");
  const custom = field(formData, "customReason").slice(0, 300);
  const outcome = field(formData, "outcome");

  if (!(REJECTION_REASONS as readonly string[]).includes(choice)) {
    return { error: "Choose a rejection reason." };
  }
  if (choice === "Other" && custom.length < 3) {
    return { error: "Describe the reason when choosing “Other”." };
  }
  const outcomeOption = REJECTION_OUTCOMES.find((o) => o.value === outcome);
  if (!outcomeOption) return { error: "Choose what happens next." };

  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "pending") {
    return { error: `Already reviewed (${payment.status}) by ${payment.reviewedByName ?? "another operator"}.` };
  }

  const reason = choice === "Other" ? custom : choice;
  const rejected = await rejectPayment({
    paymentId,
    reviewer: admin,
    outcome: outcomeOption.value,
    reason,
    note: choice === "Other" ? undefined : custom || undefined,
  });
  if (!rejected) {
    return { error: "This payment was reviewed by someone else a moment ago. Refresh to see it." };
  }

  await createAuditLog({
    action: "payment_rejected",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: payment.customerId,
    paymentId,
    orderId: payment.orderId,
    reason,
    details: `Rejected ${inr(payment.amount)} · UTR ${payment.utr} · next step: ${outcomeOption.label}${custom && choice !== "Other" ? ` · note: ${custom}` : ""}`,
  });
  if (outcomeOption.value === "refund_pending") {
    await createAuditLog({
      action: "refund_initiated",
      userType: "admin",
      userId: admin.id,
      userName: admin.name,
      customerId: payment.customerId,
      paymentId,
      orderId: payment.orderId,
      details: `Refund of ${inr(payment.amount)} initiated at rejection`,
    });
  }

  const explanation = custom && choice !== "Other" ? ` ${custom}` : "";
  const message = {
    rejected: `Your payment of ${inr(payment.amount)} (UTR ${payment.utr}) was not accepted: ${reason}.${explanation}`,
    repayment_required: `Your payment of ${inr(payment.amount)} (UTR ${payment.utr}) was not accepted: ${reason}.${explanation} Please make a new payment from My Loans.`,
    refund_pending: `Your payment of ${inr(payment.amount)} (UTR ${payment.utr}) was not accepted: ${reason}.${explanation} The amount will be refunded to you.`,
  }[outcomeOption.value];
  await createNotification({
    customerId: payment.customerId,
    kind:
      outcomeOption.value === "rejected"
        ? "payment_rejected"
        : outcomeOption.value,
    title:
      outcomeOption.value === "repayment_required"
        ? "Repayment required"
        : outcomeOption.value === "refund_pending"
          ? "Payment rejected — refund pending"
          : "Payment rejected",
    message,
    paymentId,
    orderId: payment.orderId,
  });

  revalidateAdmin();
  redirect(withNotice(returnTo(formData, "/admin/payments"), "rejected"));
}

export async function initiateRefundAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const paymentId = field(formData, "paymentId");
  const note = field(formData, "note").slice(0, 300);
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found." };

  const updated = await initiateRefund({ paymentId, reviewer: admin, note: note || undefined });
  if (!updated) {
    return { error: "A refund can only be started for a rejected payment." };
  }
  await createAuditLog({
    action: "refund_initiated",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: payment.customerId,
    paymentId,
    orderId: payment.orderId,
    details: `Refund of ${inr(payment.amount)} initiated${note ? ` · ${note}` : ""}`,
  });
  await createNotification({
    customerId: payment.customerId,
    kind: "refund_pending",
    title: "Refund initiated",
    message: `A refund of ${inr(payment.amount)} for UTR ${payment.utr} has been initiated.`,
    paymentId,
    orderId: payment.orderId,
  });

  revalidateAdmin();
  redirect(withNotice(returnTo(formData, "/admin/payments"), "refund_started"));
}

export async function completeRefundAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const paymentId = field(formData, "paymentId");
  const reference = field(formData, "refundReference");
  const refundDate = field(formData, "refundDate");
  const note = field(formData, "note").slice(0, 300);

  if (!/^[A-Za-z0-9-]{6,40}$/.test(reference)) {
    return { error: "Enter the refund UTR / reference (6–40 letters or digits)." };
  }
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refundDate) || refundDate > today) {
    return { error: "Enter the date the refund was sent (not in the future)." };
  }
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found." };

  const updated = await completeRefund({
    paymentId,
    reviewer: admin,
    reference,
    refundedAt: new Date(`${refundDate}T12:00:00+05:30`).toISOString(),
    note: note || undefined,
  });
  if (!updated) {
    return { error: "Only a payment with a pending refund can be marked refunded." };
  }
  await createAuditLog({
    action: "refund_completed",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: payment.customerId,
    paymentId,
    orderId: payment.orderId,
    details: `Refunded ${inr(payment.amount)} · refund ref ${reference} · sent ${refundDate}${note ? ` · ${note}` : ""}`,
  });
  await createNotification({
    customerId: payment.customerId,
    kind: "refunded",
    title: "Refund sent",
    message: `${inr(payment.amount)} has been refunded to you (refund reference ${reference}).`,
    paymentId,
    orderId: payment.orderId,
  });

  revalidateAdmin();
  redirect(withNotice(returnTo(formData, "/admin/payments"), "refunded"));
}

// Leaves a submitted payment under review, recording that it was looked at.
export async function keepPaymentPendingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const paymentId = field(formData, "paymentId");
  const note = field(formData, "note").slice(0, 300);
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "pending") {
    return { error: `Already reviewed (${payment.status}) by ${payment.reviewedByName ?? "another operator"}.` };
  }
  await createAuditLog({
    action: "payment_kept_pending",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: payment.customerId,
    paymentId,
    orderId: payment.orderId,
    details: `Left pending · UTR ${payment.utr}${note ? ` · ${note}` : ""}`,
  });
  revalidateAdmin();
  redirect(withNotice(returnTo(formData, "/admin/payments"), "kept_pending"));
}

// --- Loan management (independent of customer payments / UTR) ---------------

const LOAN_NOT_OPEN =
  "This loan isn't awaiting payment any more — it may have a payment under review, or already be paid or cancelled. Refresh to see its current state.";

// Marks a loan paid without any customer payment/UTR. No payment record is
// created and no UTR is invented.
export async function markLoanPaidAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const orderId = field(formData, "orderId");
  const note = field(formData, "note").slice(0, 300);
  const order = await getOrder(orderId);
  if (!order) return { error: "Loan not found." };

  const updated = await markLoanPaid({ orderId, reviewer: admin, note: note || undefined });
  if (!updated) return { error: LOAN_NOT_OPEN };

  await createAuditLog({
    action: "loan_marked_paid",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: order.customerId,
    orderId,
    details: `${order.productName} · ${inr(updated.settledAmount ?? order.amountDue)} marked paid directly · UTR: none${note ? ` · ${note}` : ""}`,
  });
  await createNotification({
    customerId: order.customerId,
    kind: "loan_paid",
    title: "Loan marked as paid",
    message: `Your ${order.productName} loan of ${inr(updated.settledAmount ?? order.amountDue)} has been marked as paid. No further payment is needed.`,
    orderId,
  });

  revalidateAdmin();
  revalidatePath("/home");
  revalidatePath("/orders");
  redirect(withNotice(returnTo(formData, "/admin/orders"), "loan_paid"));
}

export async function cancelLoanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const orderId = field(formData, "orderId");
  const choice = field(formData, "cancelReason");
  const custom = field(formData, "customReason").slice(0, 300);
  if (!(LOAN_CANCEL_REASONS as readonly string[]).includes(choice)) {
    return { error: "Choose a reason." };
  }
  if (choice === "Other" && custom.length < 3) {
    return { error: "Describe the reason when choosing “Other”." };
  }
  const order = await getOrder(orderId);
  if (!order) return { error: "Loan not found." };

  const reason = choice === "Other" ? custom : choice;
  const note = choice === "Other" ? undefined : custom || undefined;
  const updated = await cancelLoan({ orderId, reviewer: admin, reason, note });
  if (!updated) return { error: LOAN_NOT_OPEN };

  await createAuditLog({
    action: "loan_cancelled",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: order.customerId,
    orderId,
    reason,
    details: `${order.productName} · ${inr(order.amountDue)} cancelled · UTR: none${note ? ` · ${note}` : ""}`,
  });
  await createNotification({
    customerId: order.customerId,
    kind: "loan_cancelled",
    title: "Loan cancelled",
    message: `Your ${order.productName} loan of ${inr(order.amountDue)} was cancelled: ${reason}.${note ? ` ${note}` : ""} No payment is needed.`,
    orderId,
  });

  revalidateAdmin();
  revalidatePath("/home");
  revalidatePath("/orders");
  redirect(withNotice(returnTo(formData, "/admin/orders"), "loan_cancelled"));
}

// Leaves an open loan exactly as it is; the review is recorded in the audit log.
export async function keepLoanPendingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const orderId = field(formData, "orderId");
  const note = field(formData, "note").slice(0, 300);
  const order = await getOrder(orderId);
  if (!order) return { error: "Loan not found." };
  if (order.status === "paid" || order.status === "cancelled") {
    return { error: `This loan is already ${order.status}.` };
  }
  await createAuditLog({
    action: "loan_kept_pending",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: order.customerId,
    orderId,
    details: `${order.productName} · ${inr(order.amountDue)} left ${order.status === "review" ? "with payment under review" : "awaiting payment"}${note ? ` · ${note}` : ""}`,
  });
  revalidateAdmin();
  redirect(withNotice(returnTo(formData, "/admin/orders"), "kept_pending"));
}

// --- Loan origination --------------------------------------------------------

// Admin creates a loan directly for a customer: a free-text product name, the
// exact amount to repay and the exact due date. No catalogue product, rate or
// tenure is involved.
export async function createLoanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const customerId = field(formData, "customerId");
  const productName = field(formData, "productName").replace(/\s+/g, " ");
  const amountRaw = field(formData, "amount");
  const dueDay = field(formData, "dueDate");
  const upiId = field(formData, "upiId");

  const customer = await getCustomerById(customerId);
  if (!customer) return { error: "Select a customer." };
  if (customer.status === "inactive") {
    return { error: "This customer is deactivated. Reactivate them first." };
  }
  if (productName.length < 2 || productName.length > 60) {
    return { error: "Enter a product name (2–60 characters)." };
  }
  const amount = Number(amountRaw);
  if (!/^\d+$/.test(amountRaw) || !Number.isSafeInteger(amount) || amount < 1 || amount > 10_000_000) {
    return { error: "Enter the loan amount in whole rupees (₹1 – ₹1,00,00,000)." };
  }
  const today = todayIst();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay) || Number.isNaN(Date.parse(dueDay))) {
    return { error: "Select a valid due date." };
  }
  if (dueDay < today) {
    return { error: "The due date can't be in the past." };
  }
  if (Date.parse(dueDay) - Date.parse(today) > 5 * 366 * 24 * 60 * 60 * 1000) {
    return { error: "The due date must be within the next 5 years." };
  }
  if (upiId && !UPI_RE.test(upiId)) {
    return { error: "Enter a valid UPI ID like name@bank, or leave it blank to use Settings." };
  }

  const order = await createOrder({
    customerId: customer.id,
    productName,
    principal: amount,
    amountDue: amount,
    dueDate: dueDateFromDay(dueDay),
    upiId: upiId || undefined,
    createdBy: admin.id,
  });
  await createAuditLog({
    action: "loan_created",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: customer.id,
    orderId: order.id,
    details: `${productName} · ${inr(amount)} · due ${shortDate(order.dueDate)}${upiId ? ` · UPI ${upiId}` : ""}`,
  });
  await createNotification({
    customerId: customer.id,
    kind: "loan_created",
    title: "New loan added",
    message: `${productName}: ${inr(amount)} is due by ${shortDate(order.dueDate)}.`,
    orderId: order.id,
  });

  revalidateAdmin();
  revalidatePath("/home");
  revalidatePath("/orders");
  redirect(`/admin/customers/${customer.id}?notice=loan_created`);
}

// Approve an application (possibly with edited product/amount/tenure) -> loan.
export async function approveApplicationAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const applicationId = String(formData.get("applicationId") ?? "");
  const application = await getApplication(applicationId);
  if (!application || application.status !== "pending") {
    redirect("/admin/applications");
  }

  // Admin may override the requested product/amount/tenure at approval time.
  const productId = String(formData.get("productId") || application.productId);
  const amountRaw = Number(formData.get("amount"));
  const tenureRaw = Number(formData.get("tenureMonths"));
  const principal =
    Number.isFinite(amountRaw) && amountRaw > 0
      ? Math.round(amountRaw)
      : application.amount;
  const tenureMonths =
    Number.isFinite(tenureRaw) && tenureRaw >= 1 && tenureRaw <= 60
      ? Math.round(tenureRaw)
      : application.tenureMonths;

  const product = (await getProduct(productId)) ?? (await getProduct(application.productId));
  if (!product) redirect("/admin/applications");

  // Claim the decision first so a double submit can't create two loans.
  const claimed = await decideApplication(application.id, {
    status: "approved",
    productId: product.id,
    productName: product.name,
    amount: principal,
    tenureMonths,
    reviewedBy: admin.id,
    reviewedByName: admin.name,
    reviewedAt: new Date().toISOString(),
  });
  if (!claimed) redirect("/admin/applications");

  const amountDue = totalRepayable(principal, product.rateMonthly, tenureMonths);
  const order = await createOrder({
    customerId: application.customerId,
    productId: product.id,
    productName: product.name,
    principal,
    amountDue,
    tenureMonths,
    rateMonthly: product.rateMonthly,
    dueDate: addMonthsIso(tenureMonths),
    applicationId: application.id,
  });
  await updateApplication(application.id, { orderId: order.id });

  await createAuditLog({
    action: "loan_application_approved",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: application.customerId,
    orderId: order.id,
    details: `${application.id} → ${order.id} · ${product.name} · ${inr(principal)} for ${tenureMonths} months`,
  });
  await createNotification({
    customerId: application.customerId,
    kind: "application_approved",
    title: "Loan application approved",
    message: `Your ${product.name} application for ${inr(principal)} was approved. ${inr(amountDue)} is repayable.`,
    orderId: order.id,
  });

  revalidateAdmin();
  redirect("/admin/applications");
}

export async function rejectApplicationAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason =
    String(formData.get("reason") ?? "").trim().slice(0, 300) ||
    "Application did not meet our current criteria.";
  const application = await decideApplication(applicationId, {
    status: "rejected",
    reason,
    reviewedBy: admin.id,
    reviewedByName: admin.name,
    reviewedAt: new Date().toISOString(),
  });
  if (!application) redirect("/admin/applications");

  await createAuditLog({
    action: "loan_application_rejected",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    customerId: application.customerId,
    reason,
    details: `${application.id} · ${application.productName} · ${inr(application.amount)}`,
  });
  await createNotification({
    customerId: application.customerId,
    kind: "application_rejected",
    title: "Loan application not approved",
    message: `Your ${application.productName} application was not approved: ${reason}`,
  });

  revalidateAdmin();
  redirect("/admin/applications");
}

// --- Settings ----------------------------------------------------------------

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  // The collection UPI ID decides where customer money goes: owner only.
  if (admin.role !== "owner") {
    return { error: "Only the owner can change settings." };
  }
  const appName = field(formData, "appName");
  const upiId = field(formData, "upiId");
  const payeeName = field(formData, "payeeName");
  const supportEmail = field(formData, "supportEmail");
  const supportPhone = field(formData, "supportPhone");
  const themeColorRaw = field(formData, "themeColor");

  if (!appName) return { error: "App name can't be empty." };
  if (themeColorRaw && !/^#[0-9a-fA-F]{6}$/.test(themeColorRaw)) {
    return { error: "Theme color must be a 6-digit hex like #66c4ff." };
  }
  if (!UPI_RE.test(upiId)) {
    return { error: "Enter the collection UPI ID customers should pay to, like name@bank." };
  }
  if (payeeName.length < 2) {
    return { error: "Enter the payee name shown in UPI apps." };
  }

  // Optional uploaded UPI QR (e.g. the merchant QR issued by the bank).
  const qrFile = formData.get("upiQrImage");
  const removeQr = field(formData, "removeUpiQr") === "1";
  let qrChange = "";
  if (qrFile instanceof File && qrFile.size > 0) {
    if (qrFile.size > UPI_QR_MAX_BYTES) {
      return { error: "The UPI QR image must be smaller than 1MB." };
    }
    const bytes = Buffer.from(await qrFile.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) return { error: "Upload the UPI QR as a JPG, PNG or WebP image." };
    await setUpiQrImage(`data:${mime};base64,${bytes.toString("base64")}`);
    qrChange = " · UPI QR image uploaded";
  } else if (removeQr) {
    await clearUpiQrImage();
    qrChange = " · UPI QR image removed";
  }

  await updateSettings({
    appName,
    upiId,
    payeeName,
    supportEmail,
    supportPhone,
    ...(themeColorRaw ? { themeColor: themeColorRaw } : {}),
  });
  await createAuditLog({
    action: "settings_updated",
    userType: "admin",
    userId: admin.id,
    userName: admin.name,
    details: `App name “${appName}”, collection UPI ${upiId}, payee ${payeeName}${qrChange}`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
