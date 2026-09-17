"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword, newToken } from "@/lib/auth";
import {
  createApplication,
  createCustomer,
  createPayment,
  createSession,
  deleteSession,
  getCustomerByMobile,
  getOrder,
  getProduct,
  updateCustomer,
  updateOrder,
} from "@/lib/db";
import {
  clearSessionCookie,
  getCurrentCustomer,
  setSessionCookie,
  SESSION_COOKIE,
} from "@/lib/session";
import { cookies } from "next/headers";
import type { PayApp } from "@/lib/types";
import type { FormState } from "@/lib/form";

const MOBILE_RE = /^[6-9][0-9]{9}$/;
const UTR_RE = /^[0-9]{12}$/;
const PAY_APPS: PayApp[] = ["phonepe", "paytm", "gpay"];

// --- Login / register --------------------------------------------------------

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const mobile = String(formData.get("mobile") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (!MOBILE_RE.test(mobile)) {
    return { error: "Enter a valid 10-digit mobile number." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const existing = await getCustomerByMobile(mobile);
  let customerId: string;

  if (existing) {
    if (!verifyPassword(password, existing.passwordHash, existing.passwordSalt)) {
      return { error: "Incorrect password for this mobile number." };
    }
    customerId = existing.id;
  } else {
    // First sign-in for this number creates the account.
    const created = await createCustomer({ mobile, name: "Customer", password });
    customerId = created.id;
  }

  const token = newToken();
  await createSession(token, customerId);
  await setSessionCookie(token);
  redirect("/home");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  await clearSessionCookie();
  redirect("/login");
}

// --- Profile -----------------------------------------------------------------

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (name.length < 2) {
    return { error: "Please enter your name (at least 2 characters)." };
  }

  await updateCustomer(customer.id, { name, email });
  revalidatePath("/profile");
  redirect("/profile");
}

// --- Loan application --------------------------------------------------------

export async function applyForLoanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const productId = String(formData.get("productId") ?? "");
  const amount = Number(formData.get("amount"));
  const tenureMonths = Number(formData.get("tenureMonths"));
  const purpose = String(formData.get("purpose") ?? "").trim();

  const product = await getProduct(productId);
  if (!product) {
    return { error: "Please choose a loan product." };
  }
  if (!Number.isFinite(amount) || amount < product.min || amount > product.max) {
    return {
      error: `Enter an amount between ₹${product.min} and ₹${product.max}.`,
    };
  }
  if (!Number.isFinite(tenureMonths) || tenureMonths < 1 || tenureMonths > 60) {
    return { error: "Choose a valid tenure." };
  }

  await createApplication({
    customerId: customer.id,
    productId: product.id,
    productName: product.name,
    amount: Math.round(amount),
    tenureMonths: Math.round(tenureMonths),
    purpose: purpose || undefined,
  });

  revalidatePath("/orders");
  redirect("/orders?applied=1");
}

// --- Repayment ---------------------------------------------------------------

export async function submitRepaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const orderId = String(formData.get("orderId") ?? "");
  const utr = String(formData.get("utr") ?? "").trim();
  const payApp = String(formData.get("payApp") ?? "") as PayApp;
  const proof = formData.get("proofImage") as File | null;

  const order = await getOrder(orderId);
  if (!order || order.customerId !== customer.id) {
    return { error: "Order not found." };
  }
  if (order.status === "paid") {
    return { error: "This loan is already fully repaid." };
  }
  if (!PAY_APPS.includes(payApp)) {
    return { error: "Please choose the app you paid with." };
  }
  if (!UTR_RE.test(utr)) {
    return { error: "Enter the 12-digit UTR / reference number from your payment." };
  }

  let proofImage = "";
  if (proof && proof.size > 0) {
    if (!proof.type.startsWith("image/")) {
      return { error: "Please upload a valid image file as proof." };
    }
    if (proof.size > 5 * 1024 * 1024) {
      return { error: "Payment proof must be smaller than 5MB." };
    }
    const bytes = Buffer.from(await proof.arrayBuffer());
    proofImage = `data:${proof.type};base64,${bytes.toString("base64")}`;
  }

  await createPayment({
    orderId: order.id,
    customerId: customer.id,
    amount: order.amountDue,
    upiId: order.upiId,
    utr,
    payApp,
    proofImage,
    paymentMethod: payApp,
  });
  await updateOrder(order.id, { status: "review" });
  revalidatePath(`/repay/${order.id}`);
  revalidatePath("/orders");
  redirect(`/repay/${order.id}`);
}
