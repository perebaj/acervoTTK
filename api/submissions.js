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

function resolveBaseOrigin(req) {
  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  const proto = req.headers?.["x-forwarded-proto"] || "https";
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host || "localhost:3000";
  return `${proto}://${host}`;
}

export function createSubmissionsHandler({
  store = vercelBlobStore,
  secret = process.env.APPROVAL_SECRET,
  notifyEmail = process.env.NOTIFY_EMAIL || "perebaj@gmail.com",
  sendEmail = defaultSendEmail,
} = {}) {
  return async function submissionsHandler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido." });
    }

    try {
      const item = validateSubmission(req.body);
      await store.put(`pending/${item.id}.json`, JSON.stringify(item));

      const activeSecret = secret || process.env.APPROVAL_SECRET;
      const token = signReviewToken(item.id, activeSecret);
      const origin = resolveBaseOrigin(req);
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
