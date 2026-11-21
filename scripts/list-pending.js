import { list } from "@vercel/blob";
import { signReviewToken } from "../lib/core.js";

const siteUrl = (process.env.PUBLIC_SITE_URL || "https://acervo-ttk.vercel.app").replace(/\/+$/, "");
const secret = process.env.APPROVAL_SECRET;

const page = await list({ prefix: "pending/" });
if (page.blobs.length === 0) {
  console.log("Nenhum envio pendente na fila.");
  process.exit(0);
}

for (const blob of page.blobs) {
  const res = await fetch(blob.url, { cache: "no-store" });
  const item = await res.json();
  const token = signReviewToken(item.id, secret);
  console.log(`- [${item.kind}] ${item.author}: "${item.caption}"`);
  console.log(`  Revisar: ${siteUrl}/?review=${item.id}&token=${token}`);
}
