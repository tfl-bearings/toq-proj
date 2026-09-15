import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/db";

// Settings (name, theme) are read from the store per request.
export const dynamic = "force-dynamic";

// Pick black or white text for a given background using WCAG relative
// luminance, so the theme color stays legible whatever the admin chooses.
function readableOn(hex: string): string {
  const c = hex.replace("#", "");
  const lin = (h: string) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L =
    0.2126 * lin(c.slice(0, 2)) +
    0.7152 * lin(c.slice(2, 4)) +
    0.0722 * lin(c.slice(4, 6));
  return L > 0.5 ? "#0b2a3d" : "#ffffff";
}

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  return {
    title: `${s.appName} — Credit Wallet`,
    description: "Manage your loan account and repayments.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: s.appName,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const s = getSettings();
  return {
    themeColor: s.themeColor,
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = getSettings();
  const themeCss = `:root{--mloan-primary:${s.themeColor};--mloan-on-primary:${readableOn(
    s.themeColor,
  )};}`;

  return (
    <html lang="en">
      <body className="mloan-mobile-theme">
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        {children}
      </body>
    </html>
  );
}
