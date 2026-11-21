import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  MAX_UPLOAD_BYTES,
  ALLOWED_CONTENT_TYPES,
  needsOpusConversion,
  classifyMediaKind,
  escapeHtml,
} from "./shared.js";

export {
  MAX_UPLOAD_BYTES,
  ALLOWED_CONTENT_TYPES,
  needsOpusConversion,
  classifyMediaKind,
  escapeHtml,
};

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function extractStoreIdFromToken(blobToken = "") {
  const m = /^vercel_blob_rw_([a-z0-9]+)_/i.exec(String(blobToken).trim());
  return m ? m[1].toLowerCase() : null;
}

// Require /media/ path and match this deployment's store host when BLOB_READ_WRITE_TOKEN is available.
export function isTrustedBlobUrl(rawUrl, blobToken = process.env.BLOB_READ_WRITE_TOKEN) {
  try {
    const parsed = new URL(String(rawUrl));
    if (parsed.protocol !== "https:" || !parsed.pathname.startsWith("/media/")) {
      return false;
    }
    const storeId = extractStoreIdFromToken(blobToken);
    if (storeId) {
      return parsed.hostname.toLowerCase() === `${storeId}${BLOB_HOST_SUFFIX}`;
    }
    return parsed.hostname.toLowerCase().endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

function cleanText(raw, maxLen) {
  return String(raw ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function validateSubmission(input = {}, { blobToken = process.env.BLOB_READ_WRITE_TOKEN } = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("Payload inválido.");
  }
  if (input.website && String(input.website).trim() !== "") {
    throw new Error("Submissão bloqueada.");
  }

  const author = cleanText(input.author, 60) || "Anônimo da resenha";
  const caption = cleanText(input.caption, 240);
  const mediaUrl = String(input.mediaUrl ?? "").trim();
  const mimeType = String(input.mimeType ?? "").split(";")[0].trim().toLowerCase();

  if (!isTrustedBlobUrl(mediaUrl, blobToken)) {
    throw new Error("mediaUrl inválida: precisa pertencer ao diretório /media/ do Vercel Blob deste projeto.");
  }

  const kind = classifyMediaKind(mimeType);
  const id = randomUUID().replaceAll("-", "").slice(0, 12);
  const createdAt = new Date().toISOString();

  return {
    id,
    author,
    caption,
    kind,
    mediaUrl,
    mimeType,
    createdAt,
  };
}

export function signReviewToken(id, secret) {
  if (!secret || String(secret).length < 16) {
    throw new Error("APPROVAL_SECRET ausente ou muito curto.");
  }
  return createHmac("sha256", String(secret)).update(String(id)).digest("hex");
}

export function verifyReviewToken(id, token, secret) {
  if (!id || !token || !secret || String(secret).length < 16) {
    return false;
  }
  const expectedHex = signReviewToken(id, secret);
  const candidateHex = String(token).trim().toLowerCase();
  if (candidateHex.length !== expectedHex.length || !/^[0-9a-f]+$/.test(candidateHex)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(candidateHex, "hex"), Buffer.from(expectedHex, "hex"));
}

const KIND_LABELS = {
  video: "Vídeo",
  audio: "Áudio",
  image: "Foto",
};

export function buildReviewEmail({ item, reviewUrl }) {
  const kindLabel = KIND_LABELS[item.kind] || "Mídia";
  const safeAuthor = escapeHtml(item.author || "Anônimo");
  const safeCaption = escapeHtml(item.caption || "(sem legenda)");
  const safeUrl = escapeHtml(reviewUrl);
  const safeKind = escapeHtml(kindLabel);

  const subject = `[Acervo TTK] Novo envio (${kindLabel}) de ${item.author || "Anônimo"}`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#1a1412;color:#f5ede2;border:2px solid #d93829;border-radius:8px;">
  <h2 style="margin:0 0 12px;color:#ffd23f;">🍺 Nova lembrança enviada pro Acervo TTK</h2>
  <p style="margin:0 0 8px;"><strong>Enviado por:</strong> ${safeAuthor}</p>
  <p style="margin:0 0 8px;"><strong>Tipo:</strong> ${safeKind}</p>
  <p style="margin:0 0 20px;"><strong>Legenda:</strong> ${safeCaption}</p>
  <p style="margin:0 0 20px;">
    <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#d93829;color:#ffffff;font-weight:700;text-decoration:none;border-radius:6px;">
      Revisar e aprovar / rejeitar
    </a>
  </p>
  <p style="margin:0;font-size:12px;color:#b8a99a;word-break:break-all;">Link direto: ${safeUrl}</p>
</div>`.trim();

  const text = [
    `Nova lembrança enviada pro Acervo TTK`,
    `Enviado por: ${item.author || "Anônimo"}`,
    `Tipo: ${kindLabel}`,
    `Legenda: ${item.caption || "(sem legenda)"}`,
    ``,
    `Revisar e aprovar ou rejeitar: ${reviewUrl}`,
  ].join("\n");

  return { subject, html, text };
}
