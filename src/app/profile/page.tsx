import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentCustomer } from "@/lib/session";
import { logoutAction } from "@/app/actions";

export default async function ProfilePage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();

  return (
    <AppShell variant="inner" title="Profile" initial={initial} back="/home">
      <section className="mloan-simple-profile">
        <div className="mloan-simple-avatar">
          <div className="mloan-avatar-fallback">{initial}</div>
        </div>

        <div className="mloan-simple-profile-value">
          <small>Customer Name</small>
          <strong>{customer.name}</strong>
        </div>
        <div className="mloan-simple-profile-value">
          <small>Customer Phone Number</small>
          <strong>{customer.mobile}</strong>
        </div>
        {customer.email ? (
          <div className="mloan-simple-profile-value">
            <small>Email</small>
            <strong>{customer.email}</strong>
          </div>
        ) : null}

        <Link
          className="mloan-btn mloan-btn-secondary mloan-btn-block"
          href="/profile/edit"
        >
          Change Profile
        </Link>
      </section>

      <div className="mloan-profile-menu">
        <Link href="/about">
          <span aria-hidden>ℹ️</span>
          About us
          <b aria-hidden>›</b>
        </Link>
        <Link href="/faq">
          <span aria-hidden>❓</span>
          FAQ
          <b aria-hidden>›</b>
        </Link>
        <Link href="/support">
          <span aria-hidden>💬</span>
          Support
          <b aria-hidden>›</b>
        </Link>
        <form action={logoutAction} className="mloan-menu-form">
          <button type="submit">
            <span aria-hidden>↩</span>
            Log out
            <b aria-hidden>›</b>
          </button>
        </form>
      </div>
    </AppShell>
  );
}
