import { getPaymentProof } from "@/lib/db";
import { decodeProof, sniffImage } from "@/lib/proof";
import { getCurrentAdmin } from "@/lib/session";

// Serves a payment screenshot to signed-in operators only. The bytes are
// re-sniffed on every request and served with a locked-down CSP, so a stored
// file can only ever render as an image — never as a document with script.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const { paymentId } = await params;
  const proof = await getPaymentProof(paymentId);
  if (!proof?.proofImage) return new Response("Not found", { status: 404 });

  const bytes = decodeProof(proof.proofImage);
  const mime = bytes ? sniffImage(bytes) : null;
  if (!bytes || !mime) {
    return new Response("Unsupported file type", { status: 415 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${paymentId}.${mime.split("/")[1]}"`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
