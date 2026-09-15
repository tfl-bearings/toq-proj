import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  const s = await getSettings();
  return {
    name: `${s.appName} — Credit Wallet`,
    short_name: s.appName,
    description: "Manage your loan account and repayments.",
    start_url: "/home",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: s.themeColor,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
