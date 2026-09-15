import Link from "next/link";
import InstallButton from "./InstallButton";

export default function TopBar({
  variant,
  title,
  initial,
  back = "/home",
}: {
  variant: "home" | "inner";
  title: string;
  initial: string;
  back?: string;
}) {
  const avatar = (
    <Link href="/profile" className="mloan-top-avatar" aria-label="Profile">
      <span className="mloan-avatar-fallback">{initial}</span>
    </Link>
  );

  if (variant === "home") {
    return (
      <header className="mloan-topbar mloan-topbar-home">
        <div className="mloan-brand">
          <span className="mloan-header-logo" aria-hidden>
            💳
          </span>
          <span>{title}</span>
        </div>
        <InstallButton />
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
