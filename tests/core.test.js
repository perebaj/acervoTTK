import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_UPLOAD_BYTES,
  ALLOWED_CONTENT_TYPES,
  needsOpusConversion,
  classifyMediaKind,
  validateSubmission,
  signReviewToken,
  verifyReviewToken,
  escapeHtml,
  buildReviewEmail,
} from "../lib/core.js";

test("detects .opus and double-extension .mp3.opus WhatsApp files", () => {
  assert.equal(needsOpusConversion("WhatsApp Audio 2026-11-21 at 18.10.mp3.opus", ""), true);
  assert.equal(needsOpusConversion("voice.ogg", "audio/ogg; codecs=opus"), true);
  assert.equal(needsOpusConversion("duttkaudio1.mp3", "audio/mpeg"), false);
  assert.equal(needsOpusConversion("clip.mp4", "video/mp4"), false);
});

test("classifies allowed media MIME types and enforces 50 MB cap constant", () => {
  assert.equal(MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
  assert.ok(ALLOWED_CONTENT_TYPES.includes("audio/mpeg"));
  assert.ok(!ALLOWED_CONTENT_TYPES.includes("audio/ogg"));
  assert.equal(classifyMediaKind("video/mp4"), "video");
  assert.equal(classifyMediaKind("audio/mpeg"), "audio");
  assert.equal(classifyMediaKind("image/jpeg"), "image");
});

test("validates submission, trims fields, and rejects untrusted media hosts", () => {
  const item = validateSubmission({
    author: "  João  ",
    caption: "  Engradado de 24 na MP Conveniência  ",
    mediaUrl: "https://store123.public.blob.vercel-storage.com/media/foto.jpeg",
    mimeType: "image/jpeg",
  });
  assert.ok(item.id.length >= 8);
  assert.equal(item.author, "João");
  assert.equal(item.caption, "Engradado de 24 na MP Conveniência");
  assert.equal(item.kind, "image");

  assert.throws(
    () =>
      validateSubmission({
        author: "Bob",
        caption: "Teste",
        mediaUrl: "https://evil.example.com/payload.mp4",
        mimeType: "video/mp4",
      }),
    /mediaUrl/i
  );

  // Rejects non-/media/ paths (e.g. pointing at items/*.json) and foreign Blob stores
  assert.throws(
    () =>
      validateSubmission(
        {
          author: "Bob",
          caption: "Delete live item",
          mediaUrl: "https://store123.public.blob.vercel-storage.com/items/1001-seed1.json",
          mimeType: "image/jpeg",
        },
        { blobToken: "vercel_blob_rw_store123_secret" }
      ),
    /mediaUrl/i
  );
  assert.throws(
    () =>
      validateSubmission(
        {
          author: "Bob",
          caption: "Foreign store",
          mediaUrl: "https://foreign999.public.blob.vercel-storage.com/media/pic.jpeg",
          mimeType: "image/jpeg",
        },
        { blobToken: "vercel_blob_rw_store123_secret" }
      ),
    /mediaUrl/i
  );

  // Ignores client-supplied id/createdAt and strips newlines in author
  const spoofed = validateSubmission({
    id: "../../evil",
    createdAt: "2099-01-01T00:00:00.000Z",
    author: "Renan\r\nBcc: victim@example.com",
    caption: "Oi",
    mediaUrl: "https://store123.public.blob.vercel-storage.com/media/foto.jpeg",
    mimeType: "image/jpeg",
  });
  assert.match(spoofed.id, /^[a-f0-9]{12}$/);
  assert.ok(!spoofed.createdAt.startsWith("2099-"));
  assert.ok(!/[\r\n]/.test(spoofed.author));
});

test("signs and verifies HMAC review tokens in constant time and rejects tampering", () => {
  const secret = "test-secret-32-bytes-minimum-value";
  const token = signReviewToken("abc12345", secret);
  assert.equal(verifyReviewToken("abc12345", token, secret), true);
  assert.equal(verifyReviewToken("other999", token, secret), false);
  assert.equal(verifyReviewToken("abc12345", token.slice(0, -2) + "00", secret), false);
  assert.equal(verifyReviewToken("abc12345", "short", secret), false);
});

test("escapes untrusted HTML inside review notification emails", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  const email = buildReviewEmail({
    item: {
      id: "sub1",
      author: '<script>alert("xss")</script>',
      caption: "Caixa de <b>24</b> burdoguinha",
      kind: "video",
      createdAt: "2026-11-21T21:00:00.000Z",
    },
    reviewUrl: "https://acervo-ttk.vercel.app/?review=sub1&token=deadbeef",
  });
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
  assert.ok(email.html.includes("https://acervo-ttk.vercel.app/?review=sub1&amp;token=deadbeef"));
  assert.ok(email.text.includes("https://acervo-ttk.vercel.app/?review=sub1&token=deadbeef"));
});
