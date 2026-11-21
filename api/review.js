import { vercelBlobStore } from "../lib/blob-store.js";
import { verifyReviewToken } from "../lib/core.js";

async function findPendingBlob(store, id) {
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId || safeId !== String(id)) return null;
  const targetPath = `pending/${safeId}.json`;
  const page = await store.list({ prefix: targetPath });
  return page.blobs.find((b) => b.pathname === targetPath) || null;
}

async function listAllBlobsByPrefix(store, prefix) {
  const all = [];
  let cursor;
  do {
    const page = await store.list({ prefix, cursor });
    all.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
}

async function isMediaUrlStillReferenced(store, mediaUrl, excludePendingPathname) {
  const [approvedBlobs, pendingBlobs] = await Promise.all([
    listAllBlobsByPrefix(store, "items/"),
    listAllBlobsByPrefix(store, "pending/"),
  ]);
  const candidates = [
    ...approvedBlobs,
    ...pendingBlobs.filter((b) => b.pathname !== excludePendingPathname),
  ];
  const records = await Promise.all(
    candidates.map((b) => store.fetchJson(b.url).catch(() => null))
  );
  return records.some((rec) => rec && rec.mediaUrl === mediaUrl);
}

export function createReviewHandler({
  store = vercelBlobStore,
  secret = process.env.APPROVAL_SECRET,
} = {}) {
  return async function reviewHandler(req, res) {
    const activeSecret = secret || process.env.APPROVAL_SECRET;
    res.setHeader("Cache-Control", "no-store");

    try {
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
          const ts = Number.isFinite(Date.parse(item.createdAt)) ? Date.parse(item.createdAt) : Date.now();
          const approvedKey = `items/${ts}-${item.id}.json`;
          const approvedItem = {
            ...item,
            approvedAt: new Date().toISOString(),
          };
          await store.put(approvedKey, JSON.stringify(approvedItem));
          await store.del(pendingBlob.url);
          return res.status(200).json({ status: "approved", item: approvedItem });
        }

        // Only delete the underlying media blob if no approved or sibling pending entry references it.
        const stillUsed = item.mediaUrl
          ? await isMediaUrlStillReferenced(store, item.mediaUrl, pendingBlob.pathname)
          : false;
        const toDelete = stillUsed ? [pendingBlob.url] : [pendingBlob.url, item.mediaUrl].filter(Boolean);
        await store.del(toDelete);
        return res.status(200).json({ status: "rejected" });
      }

      return res.status(405).json({ error: "Método não permitido." });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Erro interno ao processar revisão." });
    }
  };
}

export default createReviewHandler();
