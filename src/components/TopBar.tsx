import Link from "next/link";
import InstallButton from "./InstallButton";

export default function TopBar({
  variant,
  title,
  initial,
  back = "/home",
  unread,
}: {
  variant: "home" | "inner";
  title: string;
  initial: string;
  back?: string;
  unread?: number;
}) {
  const avatar = (
    <Link href="/profile" className="mloan-top-avatar" aria-label="Profile">
      <span className="mloan-avatar-fallback">{initial}</span>
    </Link>
  );

  if (variant === "home") {
    return (
      <header
        className={
          unread !== undefined
            ? "mloan-topbar mloan-topbar-home with-bell"
            : "mloan-topbar mloan-topbar-home"
        }
      >
        <div className="mloan-brand">
          <span className="mloan-header-logo" aria-hidden>
            💳
          </span>
          <span>{title}</span>
        </div>
        <InstallButton />
        {unread !== undefined ? (
          <Link
            href="/notifications"
            prefetch={false}
            className="mloan-bell"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          >
            🔔
            {unread > 0 ? <span>{unread > 9 ? "9+" : unread}</span> : null}
          </Link>
        ) : null}
        {avatar}
      </header>
    );
  }

  return (
    <header className="mloan-topbar">
      <Link href={back} className="mloan-back" aria-label="Back">
        ‹
      </Link>
      <div className="mloan-brand">
        <span>{title}</span>
      </div>
      {avatar}
    </header>
  );
}
