import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Rupee Money — Operator Console",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
