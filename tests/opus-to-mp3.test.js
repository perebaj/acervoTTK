import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { encodePcmToMp3, transcodeOpusBytesToMp3 } from "../src/opus-to-mp3.js";

test("encodes mono Float32 PCM audio into valid non-empty MP3 frames", () => {
  const sampleRate = 16000;
  const samples = new Float32Array(sampleRate);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }

  const mp3Bytes = encodePcmToMp3(samples, sampleRate);
  assert.ok(mp3Bytes instanceof Uint8Array);
  assert.ok(mp3Bytes.byteLength > 1000, `Expected >1000 bytes, got ${mp3Bytes.byteLength}`);
  // MPEG-1/2 Audio frame sync begins with 0xFF and top 3 bits of second byte set (0xE0)
  assert.equal(mp3Bytes[0], 0xff);
  assert.equal(mp3Bytes[1] & 0xe0, 0xe0);
});

test("transcodes real WhatsApp .opus file into playable MP3 bytes", async () => {
  const samplePath = "/Users/jonathansilva/Downloads/acertottk/WhatsApp Audio 2026-11-21 at 18.10.mp3.opus";
  if (!fs.existsSync(samplePath)) return;
  const opusBuf = new Uint8Array(fs.readFileSync(samplePath));
  const mp3Bytes = await transcodeOpusBytesToMp3(opusBuf);
  assert.ok(mp3Bytes.byteLength > 5000);
  assert.equal(mp3Bytes[0], 0xff);
});
