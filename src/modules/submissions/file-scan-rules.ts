/**
 * The file scan's judgement (S3-11; register G3). Storage keeps whatever media type the browser claimed and no content
 * hash, so the scan reads the file's own bytes: its signature says what it really is, and its SHA-256 is the
 * authoritative checksum. Pure functions, so they can be tested without Storage.
 */

/** The scanner's name, recorded with each outcome. A future malware scanner records its own. */
export const SCANNER = "integrity-v1";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const encoder = new TextEncoder();

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function contains(bytes: Uint8Array, text: string, limit = bytes.length): boolean {
  const needle = encoder.encode(text);
  const end = Math.min(limit, bytes.length) - needle.length;
  outer: for (let index = 0; index <= end; index += 1) {
    if (bytes[index] !== needle[0]) continue;
    for (let offset = 1; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * The media type the bytes themselves show, for the types the LMS accepts, recordings included (S3-12). An Office file is a ZIP archive whose
 * entry names say which application wrote it. Anything else is "application/octet-stream".
 */
export function detectMediaType(bytes: Uint8Array): string {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // A PDF's header may follow a little leading junk; readers look in the first kilobyte.
  if (contains(bytes, "%PDF-", 1024)) return "application/pdf";
  // ISO media (MP4, M4A): a "ftyp" box at offset 4 whose brand says whether it is audio only.
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    return brand === "M4A " || brand === "M4B " ? "audio/mp4" : "video/mp4";
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && contains(bytes, "webm", 64)) return "video/webm";
  // MP3: an ID3 tag, or straight into an MPEG audio frame (11 sync bits, layer III).
  if (startsWith(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe6) === 0xe2)) return "audio/mpeg";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (contains(bytes, "word/document.xml")) return DOCX;
    if (contains(bytes, "xl/workbook.xml")) return XLSX;
    if (contains(bytes, "ppt/presentation.xml")) return PPTX;
    return "application/zip";
  }
  return "application/octet-stream";
}

export type ScanReason = "type_mismatch" | "checksum_mismatch" | "size_mismatch";

export interface ScanVerdict {
  outcome: "clean" | "rejected";
  reason: ScanReason | null;
}

/**
 * Clean when the bytes are the size Storage recorded, carry the checksum the learner declared (if they declared one),
 * and are one of the types allowed for the upload. Otherwise rejected, with the first reason that applies.
 */
export function scanVerdict({
  length,
  recordedBytes,
  sha256,
  declaredSha256,
  detectedMediaType,
  allowedMediaTypes,
}: {
  length: number;
  recordedBytes: number;
  sha256: string;
  declaredSha256: string | null;
  detectedMediaType: string;
  allowedMediaTypes: string[];
}): ScanVerdict {
  if (length !== recordedBytes) return { outcome: "rejected", reason: "size_mismatch" };
  if (declaredSha256 && declaredSha256.toLowerCase() !== sha256)
    return { outcome: "rejected", reason: "checksum_mismatch" };
  if (!allowedMediaTypes.includes(detectedMediaType)) return { outcome: "rejected", reason: "type_mismatch" };
  return { outcome: "clean", reason: null };
}
