import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentCustomer } from "@/lib/session";
import { listNotifications, markNotificationsRead } from "@/lib/db";
import { dateTime } from "@/lib/format";

export default async function NotificationsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const notifications = await listNotifications(customer.id);
  // Opening the page counts as reading; the unread state is captured first
  // so this visit still highlights what's new.
  if (notifications.some((n) => !n.readAt)) await markNotificationsRead(customer.id);

  return (
    <AppShell variant="inner" title="Notifications" initial={initial} back="/home">
      {notifications.length === 0 ? (
        <div className="mloan-empty-state">No notifications yet.</div>
      ) : (
        <ul className="mloan-notifications">
          {notifications.map((n) => (
            <li key={n.id} className={n.readAt ? undefined : "unread"}>
              <div className="mloan-notification-head">
                <b>{n.title}</b>
                <time>{dateTime(n.createdAt)}</time>
              </div>
              <p>{n.message}</p>
              {n.orderId ? (
                <Link href={`/repay/${n.orderId}`}>View loan →</Link>
              ) : n.paymentId ? (
                <Link href="/payments">View payments →</Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
