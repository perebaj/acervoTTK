import { vercelBlobStore } from "../lib/blob-store.js";

export function createItemsHandler({ store = vercelBlobStore } = {}) {
  return async function itemsHandler(req, res) {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Método não permitido." });
    }

    try {
      const allBlobs = [];
      let cursor;
      do {
        const page = await store.list({ prefix: "items/", cursor });
        allBlobs.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);

      const items = await Promise.all(
        allBlobs.map((b) => store.fetchJson(b.url).catch(() => null))
      );

      const rankOf = (item) => Number(item.featuredRank ?? (item.featured ? 1 : 0));
      const valid = items
        .filter(Boolean)
        .sort(
          (a, b) =>
            rankOf(b) - rankOf(a) ||
            String(b.createdAt).localeCompare(String(a.createdAt))
        );

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ items: valid });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Falha ao carregar acervo." });
    }
  };
}

export default createItemsHandler();
