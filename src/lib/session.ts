import { cookies } from "next/headers";
import {
  getAdminById,
  getAdminSession,
  getCustomerById,
  getSession,
} from "./db";
import type { Admin, Customer } from "./types";

export const SESSION_COOKIE = "toq_session";
export const ADMIN_SESSION_COOKIE = "toq_admin_session";

// Reads the session cookie and resolves the logged-in customer (or null).
export async function getCurrentCustomer(): Promise<Customer | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  return (await getCustomerById(session.customerId)) ?? null;
}

// Cookie mutations may only run inside Server Actions / Route Handlers.
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day, like the original app token
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// --- Admin (operator) session ------------------------------------------------

export async function getCurrentAdmin(): Promise<Admin | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getAdminSession(token);
  if (!session) return null;
  return (await getAdminById(session.adminId)) ?? null;
}

export async function setAdminSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8-hour operator shift
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
}
