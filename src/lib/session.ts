import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getAdminById,
  getAdminSession,
  getCustomerById,
  getSession,
} from "./db";
import type { Admin, Customer } from "./types";

export const SESSION_COOKIE = "toq_session";
export const ADMIN_SESSION_COOKIE = "toq_admin_session";

const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24; // 1 day, like the original app token
const ADMIN_SESSION_SECONDS = 60 * 60 * 8; // 8-hour operator shift

function isExpired(createdAt: string, maxAgeSeconds: number): boolean {
  const started = new Date(createdAt).getTime();
  return !Number.isFinite(started) || Date.now() - started > maxAgeSeconds * 1000;
}

function adminCookieSignature(token: string, adminId: string): string {
  const secret =
    process.env.ADMIN_COOKIE_SECRET ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;
  if (!secret) throw new Error("ADMIN_COOKIE_SECRET or DATABASE_URL is required");
  return createHmac("sha256", secret)
    .update(`${token}.${adminId}`)
    .digest("hex");
}

function readAdminCookie(value: string): { token: string; adminId: string } | null {
  const [token, adminId, signature] = value.split(".");
  if (!token || !adminId || !signature) return null;
  const expected = adminCookieSignature(token, adminId);
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  return { token, adminId };
}

// Reads the session cookie and resolves the logged-in customer (or null).
// Expired sessions and deactivated accounts are rejected server-side.
export async function getCurrentCustomer(): Promise<Customer | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getSession(token);
  if (!session || isExpired(session.createdAt, CUSTOMER_SESSION_SECONDS)) return null;
  const customer = await getCustomerById(session.customerId);
  if (!customer || customer.status === "inactive") return null;
  return customer;
}

// Cookie mutations may only run inside Server Actions / Route Handlers.
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_SESSION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// --- Admin (operator) session ------------------------------------------------

// The cookie is `token.adminId.hmac`. The signature proves the cookie wasn't
// forged; the session row must still exist (logout deletes it) and be fresh.
export async function getCurrentAdmin(): Promise<Admin | null> {
  const store = await cookies();
  const value = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) return null;
  const signed = value.includes(".") ? readAdminCookie(value) : null;
  if (value.includes(".") && !signed) return null;
  const token = signed ? signed.token : value;
  const session = await getAdminSession(token);
  if (!session || isExpired(session.createdAt, ADMIN_SESSION_SECONDS)) return null;
  if (signed && session.adminId !== signed.adminId) return null;
  return (await getAdminById(session.adminId)) ?? null;
}

export async function setAdminSessionCookie(
  token: string,
  adminId: string,
): Promise<void> {
  const store = await cookies();
  store.set(
    ADMIN_SESSION_COOKIE,
    `${token}.${adminId}.${adminCookieSignature(token, adminId)}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_SECONDS,
    },
  );
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
}
