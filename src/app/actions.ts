"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword, newToken } from "@/lib/auth";
import {
  completeCustomerInvite,
  createApplication,
  createAuditLog,
  createCustomer,
  createNotification,
  createPayment,
  createSession,
  deleteSession,
  DuplicateMobileError,
  DuplicatePaymentError,
  findLivePaymentByUtr,
  getCustomerByMobile,
  getOrder,
  getPaymentsForOrder,
  getProduct,
  getSettings,
  touchCustomer,
  updateCustomer,
} from "@/lib/db";
import {
  clearSessionCookie,
  getCurrentCustomer,
  setSessionCookie,
  SESSION_COOKIE,
} from "@/lib/session";
import { cookies } from "next/headers";
import { NOT_ACCEPTED } from "@/lib/status";
import { PROOF_MAX_BYTES, sniffImage } from "@/lib/proof";
import {
  EMAIL_RE,
  field,
  MOBILE_RE,
  UTR_RE,
  validatePassword,
} from "@/lib/validation";
import { inr } from "@/lib/format";
import { repaymentUpi } from "@/lib/loan";
import type { FormState } from "@/lib/form";


// --- Login / register --------------------------------------------------------

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const mobile = field(formData, "mobile");
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
    if (existing.status === "inactive") {
      return { error: "This account has been deactivated. Please contact support." };
    }
    if (!existing.passwordHash) {
      return {
        error:
          "Your account isn't activated yet. Open the access link we sent you to set your password.",
      };
    }
    if (!verifyPassword(password, existing.passwordHash, existing.passwordSalt)) {
      return { error: "Incorrect password for this mobile number." };
    }
    customerId = existing.id;
    await touchCustomer(customerId, true);
  } else {
    // First sign-in for this number creates the account.
    let created;
    try {
      created = await createCustomer({ mobile, name: "Customer", password });
    } catch (error) {
      if (error instanceof DuplicateMobileError) {
        return { error: "This number was just registered. Please sign in again." };
      }
      throw error;
    }
    customerId = created.id;
    await createAuditLog({
      action: "customer_registered",
      userType: "customer",
      userId: created.id,
      userName: created.mobile,
      customerId: created.id,
      details: "Account created by self sign-up",
    });
    await createNotification({
      customerId: created.id,
      kind: "account_created",
      title: "Welcome!",
      message: "Your account is ready. Update your name from your profile.",
    });
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

// --- Access link: password setup --------------------------------------------

export async function setPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = field(formData, "token");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  const invalid = validatePassword(password, confirm);
  if (invalid) return { error: invalid };

  // Atomic: validates the link, sets the password and burns the link.
  const customer = await completeCustomerInvite(token, password);
  if (!customer) {
    return {
      error:
        "This link is invalid, has expired or was already used. Ask us for a new link.",
    };
  }

  await createAuditLog({
    action: "password_setup_completed",
    userType: "customer",
    userId: customer.id,
    userName: customer.name,
    customerId: customer.id,
    details: "Password set via access link; account activated",
  });
  await createNotification({
    customerId: customer.id,
    kind: "password_set",
    title: "Account activated",
    message: "Your password is set. Sign in with your mobile number and new password.",
  });

  const sessionToken = newToken();
  await createSession(sessionToken, customer.id);
  await setSessionCookie(sessionToken);
  redirect("/home?welcome=1");
}

// --- Profile -----------------------------------------------------------------

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const name = field(formData, "name");
  const email = field(formData, "email");

  if (name.length < 2 || name.length > 80) {
    return { error: "Please enter your name (2–80 characters)." };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address or leave it blank." };
  }

  await updateCustomer(customer.id, {
    name,
    email,
    lastActivityAt: new Date().toISOString(),
  });
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
  const purpose = field(formData, "purpose").slice(0, 200);

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

  const application = await createApplication({
    customerId: customer.id,
    productId: product.id,
    productName: product.name,
    amount: Math.round(amount),
    tenureMonths: Math.round(tenureMonths),
    purpose: purpose || undefined,
  });
  await touchCustomer(customer.id);
  await createAuditLog({
    action: "loan_application_submitted",
    userType: "customer",
    userId: customer.id,
    userName: customer.name,
    customerId: customer.id,
    details: `${product.name} · ${inr(application.amount)} · ${application.tenureMonths} months (${application.id})`,
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

  const orderId = field(formData, "orderId");
  const utr = field(formData, "utr");
  const proof = formData.get("proofImage");

  // Ownership is checked server-side: a customer can only pay their own loan.
  const order = await getOrder(orderId);
  if (!order || order.customerId !== customer.id) {
    return { error: "Loan not found." };
  }
  if (order.status === "paid" || order.amountDue <= 0) {
    return { error: "This loan is already fully repaid." };
  }
  if (order.status === "review") {
    return { error: "A payment for this loan is already under review." };
  }
  if (!UTR_RE.test(utr)) {
    return { error: "Please enter a valid 12-digit UTR number." };
  }

  let proofImage: string | undefined;
  let proofMime: string | undefined;
  let proofFilename: string | undefined;
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > PROOF_MAX_BYTES) {
      return { error: "Payment screenshot must be smaller than 4MB." };
    }
    const bytes = Buffer.from(await proof.arrayBuffer());
    // The browser's MIME type is not trusted; the file content decides.
    const mime = sniffImage(bytes);
    if (!mime) {
      return { error: "Upload the screenshot as a JPG, PNG or WebP image." };
    }
    proofMime = mime;
    proofImage = `data:${mime};base64,${bytes.toString("base64")}`;
    proofFilename = proof.name.replace(/[^\w.\- ]/g, "").slice(0, 100) || "proof";
  }

  if (await findLivePaymentByUtr(utr)) {
    return { error: "This UTR has already been submitted. Check the number and try again." };
  }

  // Link to the most recent not-accepted attempt so every retry is traceable.
  const previous = (await getPaymentsForOrder(order.id)).find((p) =>
    NOT_ACCEPTED.includes(p.status),
  );
  const { upiId } = repaymentUpi(order, await getSettings());

  let payment;
  try {
    payment = await createPayment({
      orderId: order.id,
      customerId: customer.id,
      productName: order.productName,
      amount: order.amountDue,
      amountDueAtSubmission: order.amountDue,
      upiId,
      utr,
      paymentDate: new Date().toISOString(),
      proofImage,
      proofMime,
      proofFilename,
      previousPaymentId: previous?.id,
    });
  } catch (error) {
    if (error instanceof DuplicatePaymentError) return { error: error.message };
    throw error;
  }

  await touchCustomer(customer.id);
  await createAuditLog({
    action: previous ? "repayment_submitted" : "payment_submitted",
    userType: "customer",
    userId: customer.id,
    userName: customer.name,
    customerId: customer.id,
    orderId: order.id,
    paymentId: payment.id,
    details: `${order.productName} · ${inr(payment.amount)} via UPI · UTR ${utr}${previous ? ` · follows ${previous.id}` : ""}`,
  });
  await createNotification({
    customerId: customer.id,
    kind: "payment_submitted",
    title: "Payment submitted",
    message: `We received your ${order.productName} payment of ${inr(payment.amount)} (UTR ${utr}). It will be verified shortly.`,
    paymentId: payment.id,
    orderId: order.id,
  });

  revalidatePath(`/repay/${order.id}`);
  revalidatePath("/orders");
  revalidatePath("/home");
  redirect(`/repay/${order.id}?submitted=1`);
}
