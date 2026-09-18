import { getUpiQrImage } from "@/lib/db";
import { decodeProof, sniffImage } from "@/lib/proof";
import { getCurrentAdmin, getCurrentCustomer } from "@/lib/session";

// The operator-uploaded UPI QR image, for signed-in customers (repay screen)
// and operators (settings preview). Bytes are re-sniffed and served with a
// locked-down CSP so the stored file can only render as an image.
export async function GET() {
  const viewer = (await getCurrentCustomer()) ?? (await getCurrentAdmin());
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  const image = await getUpiQrImage();
  const bytes = image ? decodeProof(image) : null;
  const mime = bytes ? sniffImage(bytes) : null;
  if (!bytes || !mime) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
