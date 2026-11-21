export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
];

// Check extension before MIME type because WhatsApp exports files named *.mp3.opus with empty or generic MIME types.
export function needsOpusConversion(filename = "", mimeType = "") {
  const lowerName = String(filename).trim().toLowerCase();
  const lowerMime = String(mimeType).trim().toLowerCase();
  if (lowerName.endsWith(".opus") || lowerName.endsWith(".ogg") || lowerName.endsWith(".oga")) {
    return true;
  }
  if (lowerMime.includes("opus") || lowerMime === "audio/ogg" || lowerMime === "application/ogg") {
    return true;
  }
  return false;
}

export function classifyMediaKind(mimeType = "") {
  const clean = String(mimeType).split(";")[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(clean)) {
    throw new Error(`Tipo de arquivo não suportado: ${mimeType}`);
  }
  if (clean.startsWith("video/")) return "video";
  if (clean.startsWith("audio/")) return "audio";
  return "image";
}

export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
