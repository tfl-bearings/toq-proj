import { headers } from "next/headers";

// Public base URL for links sent to customers. An explicit APP_URL wins;
// otherwise the host the operator is using is also the customer-facing host.
export async function appBaseUrl(): Promise<string> {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function inviteUrl(token: string): Promise<string> {
  return `${await appBaseUrl()}/invite/${encodeURIComponent(token)}`;
}
