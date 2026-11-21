import { put, list, del } from "@vercel/blob";

export const vercelBlobStore = {
  async put(pathname, body) {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    return put(pathname, payload, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
  },
  async list({ prefix = "", cursor } = {}) {
    return list({ prefix, cursor });
  },
  async del(urlsOrPaths) {
    return del(urlsOrPaths);
  },
  async fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const err = new Error(`Falha ao ler blob (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  },
};
