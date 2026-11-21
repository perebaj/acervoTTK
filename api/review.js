import { vercelBlobStore } from "../lib/blob-store.js";
import { verifyReviewToken } from "../lib/core.js";

async function findPendingBlob(store, id) {
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;
  const targetPath = `pending/${safeId}.json`;
  const page = await store.list({ prefix: targetPath });
  return page.blobs.find((b) => b.pathname === targetPath) || null;
}

export function createReviewHandler({
  store = vercelBlobStore,
  secret = process.env.APPROVAL_SECRET,
} = {}) {
  return async function reviewHandler(req, res) {
    const activeSecret = secret || process.env.APPROVAL_SECRET;
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "GET") {
      const id = String(req.query?.id || "");
      const token = String(req.query?.token || "");

      if (!verifyReviewToken(id, token, activeSecret)) {
        return res.status(403).json({ error: "Link de revisão inválido ou não autorizado." });
      }

      const pendingBlob = await findPendingBlob(store, id);
      if (!pendingBlob) {
        return res.status(200).json({ status: "already_processed" });
      }

      const item = await store.fetchJson(pendingBlob.url);
      return res.status(200).json({ status: "pending", item });
    }

    if (req.method === "POST") {
      const id = String(req.body?.id || "");
      const token = String(req.body?.token || "");
      const action = String(req.body?.action || "");

      if (!verifyReviewToken(id, token, activeSecret)) {
        return res.status(403).json({ error: "Link de revisão inválido ou não autorizado." });
      }
      if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ error: "Ação inválida." });
      }

      const pendingBlob = await findPendingBlob(store, id);
      if (!pendingBlob) {
        return res.status(200).json({ status: "already_processed" });
      }

      const item = await store.fetchJson(pendingBlob.url);

      if (action === "approve") {
        const approvedItem = {
          ...item,
          approvedAt: new Date().toISOString(),
        };
        await store.put(`items/${Date.now()}-${item.id}.json`, JSON.stringify(approvedItem));
        await store.del(pendingBlob.url);
        return res.status(200).json({ status: "approved", item: approvedItem });
      }

      // Reject removes both the pending JSON and the uploaded media blob to preserve quota.
      await store.del([pendingBlob.url, item.mediaUrl].filter(Boolean));
      return res.status(200).json({ status: "rejected" });
    }

    return res.status(405).json({ error: "Método não permitido." });
  };
}

export default createReviewHandler();
