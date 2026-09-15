"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { newToken, verifyPassword } from "@/lib/auth";
import {
  createAdminSession,
  createOrder,
  deleteAdminSession,
  getAdminByUsername,
  getApplication,
  getCustomerById,
  getOrder,
  getPayment,
  getProduct,
  updateApplication,
  updateOrder,
  updatePayment,
  updateSettings,
} from "@/lib/db";
import { addMonthsIso, totalRepayable } from "@/lib/loan";
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  getCurrentAdmin,
  setAdminSessionCookie,
} from "@/lib/session";
import type { FormState } from "@/lib/form";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

// --- Auth --------------------------------------------------------------------

export async function adminLoginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
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
  await setAdminSessionCookie(token);
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) await deleteAdminSession(token);
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

// --- Payment review (the core operator task) --------------------------------

export async function approvePaymentAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");
  const payment = await getPayment(paymentId);
  if (!payment || payment.status !== "review") redirect("/admin/payments");

  await updatePayment(payment.id, {
    status: "success",
    reviewedBy: admin.id,
    reviewedByName: admin.name,
    reviewedAt: new Date().toISOString(),
  });
  // Approving a repayment closes the loan.
  await updateOrder(payment.orderId, { status: "paid", amountDue: 0 });

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  redirect("/admin/payments");
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const payment = await getPayment(paymentId);
  if (!payment || payment.status !== "review") redirect("/admin/payments");

  await updatePayment(payment.id, {
    status: "failed",
    reviewedBy: admin.id,
    reviewedByName: admin.name,
    reviewedAt: new Date().toISOString(),
    reason: reason || "Could not verify this payment against our records.",
  });
  // Rejecting returns the loan to unpaid (overdue if the due date has passed).
  const order = await getOrder(payment.orderId);
  if (order) {
    const overdue = new Date(order.dueDate).getTime() < Date.now();
    await updateOrder(order.id, { status: overdue ? "overdue" : "due" });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  redirect("/admin/payments");
}

// --- Loan origination --------------------------------------------------------

// Admin creates a loan directly for a customer.
export async function createLoanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const principal = Number(formData.get("amount"));
  const tenureMonths = Number(formData.get("tenureMonths"));

  const customer = await getCustomerById(customerId);
  if (!customer) return { error: "Select a customer." };
  const product = await getProduct(productId);
  if (!product) return { error: "Select a loan product." };
  if (!Number.isFinite(principal) || principal <= 0) {
    return { error: "Enter a valid loan amount." };
  }
  if (!Number.isFinite(tenureMonths) || tenureMonths < 1 || tenureMonths > 60) {
    return { error: "Enter a valid tenure (1–60 months)." };
  }

  const amountDue = totalRepayable(principal, product.rateMonthly, tenureMonths);
  await createOrder({
    customerId: customer.id,
    productId: product.id,
    productName: product.name,
    principal: Math.round(principal),
    amountDue,
    tenureMonths: Math.round(tenureMonths),
    rateMonthly: product.rateMonthly,
    dueDate: addMonthsIso(Math.round(tenureMonths)),
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect("/admin/orders");
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

  await updateApplication(application.id, {
    status: "approved",
    productId: product.id,
    productName: product.name,
    amount: principal,
    tenureMonths,
    orderId: order.id,
    reviewedBy: admin.id,
    reviewedByName: admin.name,
    reviewedAt: new Date().toISOString(),
  });

  revalidatePath("/admin/applications");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect("/admin/applications");
}

export async function rejectApplicationAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const application = await getApplication(applicationId);
  if (!application || application.status !== "pending") {
    redirect("/admin/applications");
  }

  await updateApplication(application.id, {
    status: "rejected",
    reason: reason || "Application did not meet our current criteria.",
    reviewedBy: admin.id,
    reviewedByName: admin.name,
    reviewedAt: new Date().toISOString(),
  });

  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  redirect("/admin/applications");
}

// --- Settings ----------------------------------------------------------------

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const appName = String(formData.get("appName") ?? "").trim();
  const upiId = String(formData.get("upiId") ?? "").trim();
  const payeeName = String(formData.get("payeeName") ?? "").trim();
  const supportEmail = String(formData.get("supportEmail") ?? "").trim();
  const supportPhone = String(formData.get("supportPhone") ?? "").trim();
  const themeColorRaw = String(formData.get("themeColor") ?? "").trim();

  if (!appName) return { error: "App name can't be empty." };
  if (themeColorRaw && !/^#[0-9a-fA-F]{6}$/.test(themeColorRaw)) {
    return { error: "Theme color must be a 6-digit hex like #66c4ff." };
  }

  await updateSettings({
    appName,
    upiId,
    payeeName,
    supportEmail,
    supportPhone,
    ...(themeColorRaw ? { themeColor: themeColorRaw } : {}),
  });
  // Re-render everything under the root layout so the new name/theme show up.
  revalidatePath("/", "layout");
  return { ok: true };
}
