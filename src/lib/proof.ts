// Payment-proof uploads. The browser-supplied MIME type is never trusted: the
// file's magic bytes decide what it is, and only raster screenshots are
// accepted (no SVG/HTML, which could carry script).

export const PROOF_MAX_BYTES = 4 * 1024 * 1024;

export type ProofMime = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(bytes: Uint8Array): ProofMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

// Decodes a stored `data:<mime>;base64,<payload>` proof back to bytes.
export function decodeProof(dataUri: string): Buffer | null {
  const comma = dataUri.indexOf(",");
  if (!dataUri.startsWith("data:") || comma < 0) return null;
  if (!dataUri.slice(0, comma).endsWith(";base64")) return null;
  return Buffer.from(dataUri.slice(comma + 1), "base64");
}
