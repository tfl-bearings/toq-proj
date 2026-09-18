import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

export default function AppShell({
  variant = "inner",
  title,
  initial,
  back,
  unread,
  children,
}: {
  variant?: "home" | "inner";
  title: string;
  initial: string;
  back?: string;
  unread?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mloan-app-shell">
      <TopBar variant={variant} title={title} initial={initial} back={back} unread={unread} />
      <main className="mloan-main">
        <article className="mloan-page-content">{children}</article>
      </main>
      <BottomNav />
    </div>
  );
}
