import test from "node:test";
import assert from "node:assert/strict";
import { signReviewToken } from "../lib/core.js";
import { createItemsHandler } from "../api/items.js";
import { createSubmissionsHandler } from "../api/submissions.js";
import { createReviewHandler } from "../api/review.js";

function makeInMemoryBlobStore() {
  const blobs = new Map();
  const deleted = [];

  return {
    blobs,
    deleted,
    async put(pathname, body) {
      const url = `https://teststore.public.blob.vercel-storage.com/${pathname}`;
      blobs.set(pathname, {
        pathname,
        url,
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
      return { url, pathname };
    },
    async list({ prefix = "", cursor } = {}) {
      const matching = [...blobs.values()]
        .filter((b) => b.pathname.startsWith(prefix))
        .sort((a, b) => a.pathname.localeCompare(b.pathname));
      // Simulate 2-item pagination pages to verify cursor loop!
      const start = cursor ? Number(cursor) : 0;
      const page = matching.slice(start, start + 2);
      const next = start + 2 < matching.length ? String(start + 2) : undefined;
      return {
        blobs: page.map((b) => ({ pathname: b.pathname, url: b.url })),
        hasMore: Boolean(next),
        cursor: next,
      };
    },
    async del(urlsOrPaths) {
      const targets = Array.isArray(urlsOrPaths) ? urlsOrPaths : [urlsOrPaths];
      for (const target of targets) {
        deleted.push(target);
        for (const [k, v] of blobs.entries()) {
          if (k === target || v.url === target) {
            blobs.delete(k);
          }
        }
      }
    },
    async fetchJson(url) {
      for (const v of blobs.values()) {
        if (v.url === url) {
          return JSON.parse(v.body);
        }
      }
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    },
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const SECRET = "super-secret-hmac-key-for-tests-1234";

test("pending submissions stay hidden from GET /api/items and trigger Resend email to perebaj@gmail.com", async () => {
  const store = makeInMemoryBlobStore();
  const sentEmails = [];

  // Seed 3 approved items to exercise multi-page cursor pagination
  for (let i = 1; i <= 3; i++) {
    await store.put(
      `items/100${i}-seed${i}.json`,
      JSON.stringify({
        id: `seed${i}`,
        author: "Acervo",
        caption: `Foto ${i}`,
        kind: "image",
        mediaUrl: `https://teststore.public.blob.vercel-storage.com/media/f${i}.jpeg`,
        mimeType: "image/jpeg",
        createdAt: `2026-11-21T10:0${i}:00.000Z`,
      })
    );
  }

  const submitHandler = createSubmissionsHandler({
    store,
    secret: SECRET,
    notifyEmail: "perebaj@gmail.com",
    sendEmail: async (msg) => {
      sentEmails.push(msg);
      return { id: "email_1" };
    },
  });

  const subRes = mockRes();
  await submitHandler(
    {
      method: "POST",
      headers: { host: "acervo-ttk.vercel.app", "x-forwarded-proto": "https" },
      body: {
        author: "Renan",
        caption: "Carlos saindo com a caixa de 24",
        mediaUrl: "https://teststore.public.blob.vercel-storage.com/media/carlos24.mp4",
        mimeType: "video/mp4",
      },
    },
    subRes
  );

  assert.equal(subRes.statusCode, 202);
  assert.equal(subRes.body.queued, true);
  assert.equal(sentEmails.length, 1);
  assert.deepEqual(sentEmails[0].to, ["perebaj@gmail.com"]);
  assert.ok(sentEmails[0].text.includes("https://acervo-ttk.vercel.app/?review="));

  const itemsHandler = createItemsHandler({ store });
  const listRes = mockRes();
  await itemsHandler({ method: "GET" }, listRes);

  assert.equal(listRes.statusCode, 200);
  // Only the 3 approved items appear; the pending video is NOT visible yet!
  assert.equal(listRes.body.items.length, 3);
  assert.equal(listRes.body.items[0].id, "seed3");
});

test("review endpoint rejects forged tokens, promotes approved items, and deletes media on reject", async () => {
  const store = makeInMemoryBlobStore();
  const reviewHandler = createReviewHandler({ store, secret: SECRET });

  const media1 = "https://teststore.public.blob.vercel-storage.com/media/approve-me.mp3";
  const media2 = "https://teststore.public.blob.vercel-storage.com/media/spam-video.mp4";

  await store.put(
    "pending/itemA.json",
    JSON.stringify({
      id: "itemA",
      author: "Amigo",
      caption: "Áudio da burdoguinha",
      kind: "audio",
      mediaUrl: media1,
      mimeType: "audio/mpeg",
      createdAt: "2026-11-21T20:00:00.000Z",
    })
  );
  await store.put(
    "pending/itemB.json",
    JSON.stringify({
      id: "itemB",
      author: "Troll",
      caption: "Spam",
      kind: "video",
      mediaUrl: media2,
      mimeType: "video/mp4",
      createdAt: "2026-11-21T20:01:00.000Z",
    })
  );

  // 1. Tampered token -> 403
  const badRes = mockRes();
  await reviewHandler(
    { method: "GET", query: { id: "itemA", token: "0000" } },
    badRes
  );
  assert.equal(badRes.statusCode, 403);

  // 2. Valid GET preview -> 200 pending
  const tokenA = signReviewToken("itemA", SECRET);
  const previewRes = mockRes();
  await reviewHandler(
    { method: "GET", query: { id: "itemA", token: tokenA } },
    previewRes
  );
  assert.equal(previewRes.statusCode, 200);
  assert.equal(previewRes.body.status, "pending");
  assert.equal(previewRes.body.item.id, "itemA");

  // 3. Approve itemA -> moves to items/ and becomes visible in GET /api/items
  const approveRes = mockRes();
  await reviewHandler(
    { method: "POST", body: { id: "itemA", token: tokenA, action: "approve" } },
    approveRes
  );
  assert.equal(approveRes.statusCode, 200);
  assert.equal(approveRes.body.status, "approved");

  // 4. Double-approve itemA -> idempotent already_processed (not 500)
  const doubleRes = mockRes();
  await reviewHandler(
    { method: "POST", body: { id: "itemA", token: tokenA, action: "approve" } },
    doubleRes
  );
  assert.equal(doubleRes.statusCode, 200);
  assert.equal(doubleRes.body.status, "already_processed");

  // 5. Reject itemB -> deletes BOTH pending/itemB.json AND media2!
  const tokenB = signReviewToken("itemB", SECRET);
  const rejectRes = mockRes();
  await reviewHandler(
    { method: "POST", body: { id: "itemB", token: tokenB, action: "reject" } },
    rejectRes
  );
  assert.equal(rejectRes.statusCode, 200);
  assert.equal(rejectRes.body.status, "rejected");
  assert.ok(store.deleted.includes(media2));

  // Confirm public gallery now contains itemA and NOT itemB
  const itemsHandler = createItemsHandler({ store });
  const listRes = mockRes();
  await itemsHandler({ method: "GET" }, listRes);
  assert.equal(listRes.body.items.length, 1);
  assert.equal(listRes.body.items[0].id, "itemA");
});

test("reject preserves mediaUrl if an approved item already references it, and submissions ignore spoofed Host headers", async () => {
  const store = makeInMemoryBlobStore();
  const liveMediaUrl = "https://teststore.public.blob.vercel-storage.com/media/live-hero.jpeg";

  await store.put(
    "items/1000-hero.json",
    JSON.stringify({
      id: "hero",
      author: "Acervo",
      caption: "Foto oficial",
      kind: "image",
      mediaUrl: liveMediaUrl,
      mimeType: "image/jpeg",
      createdAt: "2026-11-21T10:00:00.000Z",
    })
  );

  const sentEmails = [];
  const submitHandler = createSubmissionsHandler({
    store,
    secret: SECRET,
    siteUrl: "https://acervo-ttk.vercel.app",
    notifyEmail: "perebaj@gmail.com",
    sendEmail: async (msg) => {
      sentEmails.push(msg);
      return { id: "email_2" };
    },
  });

  // Attacker spoofs Host/X-Forwarded-Host and reuses liveMediaUrl
  const subRes = mockRes();
  await submitHandler(
    {
      method: "POST",
      headers: {
        host: "evil.attacker.tld",
        "x-forwarded-host": "evil.attacker.tld",
      },
      body: {
        author: "Attacker",
        caption: "Trying to nuke live hero image on reject",
        mediaUrl: liveMediaUrl,
        mimeType: "image/jpeg",
      },
    },
    subRes
  );

  assert.equal(subRes.statusCode, 202);
  // Review link MUST NOT use evil.attacker.tld!
  assert.ok(!sentEmails[0].text.includes("evil.attacker.tld"));
  assert.ok(sentEmails[0].text.includes("https://acervo-ttk.vercel.app/?review="));

  // Moderator rejects the attacker's submission -> liveMediaUrl MUST NOT be deleted!
  const subId = subRes.body.id;
  const token = signReviewToken(subId, SECRET);
  const reviewHandler = createReviewHandler({ store, secret: SECRET });
  const rejectRes = mockRes();
  await reviewHandler(
    { method: "POST", body: { id: subId, token, action: "reject" } },
    rejectRes
  );

  assert.equal(rejectRes.statusCode, 200);
  assert.equal(rejectRes.body.status, "rejected");
  assert.ok(!store.deleted.includes(liveMediaUrl), "Live approved mediaUrl must not be deleted!");
});
