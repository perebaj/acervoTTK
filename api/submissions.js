import { vercelBlobStore } from "../lib/blob-store.js";
import { buildReviewEmail, signReviewToken, validateSubmission } from "../lib/core.js";

async function defaultSendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY ausente; submissão salva em pending/ sem disparo de e-mail.");
    return { skipped: true };
  }

  const from = process.env.RESEND_FROM_EMAIL || "Acervo TTK <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend HTTP ${res.status}: ${detail}`);
  }
  return res.json();
}

// Prefer platform-set URLs over request Host headers so forged Host values cannot hijack HMAC review links.
function resolveBaseOrigin(explicitSiteUrl) {
  const candidate =
    explicitSiteUrl ||
    process.env.PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (candidate) {
    return candidate.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

export function createSubmissionsHandler({
  store = vercelBlobStore,
  secret = process.env.APPROVAL_SECRET,
  siteUrl = process.env.PUBLIC_SITE_URL || "https://acervo-ttk.vercel.app",
  notifyEmail = process.env.NOTIFY_EMAIL || "perebaj@gmail.com",
  sendEmail = defaultSendEmail,
} = {}) {
  return async function submissionsHandler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido." });
    }

    try {
      const item = validateSubmission(req.body);
      const activeSecret = secret || process.env.APPROVAL_SECRET;
      // Sign before writing to Blob so a missing secret never leaves an unreviewable pending record.
      const token = signReviewToken(item.id, activeSecret);

      await store.put(`pending/${item.id}.json`, JSON.stringify(item));

      const origin = resolveBaseOrigin(siteUrl);
      const reviewUrl = `${origin}/?review=${encodeURIComponent(item.id)}&token=${encodeURIComponent(token)}`;
      const emailContent = buildReviewEmail({ item, reviewUrl });

      let emailDispatched = true;
      try {
        await sendEmail({
          to: [notifyEmail],
          ...emailContent,
        });
      } catch (emailErr) {
        emailDispatched = false;
        console.error("Falha ao enviar e-mail de moderação:", emailErr);
      }

      return res.status(202).json({ queued: true, id: item.id, emailDispatched });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Submissão inválida." });
    }
  };
}

export default createSubmissionsHandler();
