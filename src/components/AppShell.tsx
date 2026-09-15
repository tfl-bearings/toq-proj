import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

export default function AppShell({
  variant = "inner",
  title,
  initial,
  back,
  children,
}: {
  variant?: "home" | "inner";
  title: string;
  initial: string;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mloan-app-shell">
      <TopBar variant={variant} title={title} initial={initial} back={back} />
      <main className="mloan-main">
        <article className="mloan-page-content">{children}</article>
      </main>
      <BottomNav />
    </div>
  );
}
