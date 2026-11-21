import { Mp3Encoder } from "@breezystack/lamejs";
import { OggOpusDecoder } from "ogg-opus-decoder";

export function encodePcmToMp3(samplesFloat32, sampleRate = 48000, kbps = 128) {
  const pcm16 = new Int16Array(samplesFloat32.length);
  for (let i = 0; i < samplesFloat32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samplesFloat32[i]));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const chunks = [];
  const frameSize = 1152;

  for (let offset = 0; offset < pcm16.length; offset += frameSize) {
    const slice = pcm16.subarray(offset, offset + frameSize);
    const buf = encoder.encodeBuffer(slice);
    if (buf && buf.length > 0) {
      chunks.push(new Uint8Array(buf));
    }
  }

  const tail = encoder.flush();
  if (tail && tail.length > 0) {
    chunks.push(new Uint8Array(tail));
  }

  const totalBytes = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(totalBytes);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return out;
}

export async function transcodeOpusBytesToMp3(uint8Input) {
  const decoder = new OggOpusDecoder();
  await decoder.ready;
  try {
    const { channelData, sampleRate, samplesDecoded } = await decoder.decodeFile(uint8Input);
    if (!samplesDecoded || !channelData || !channelData[0]) {
      throw new Error("Não foi possível decodificar o áudio Opus.");
    }
    return encodePcmToMp3(channelData[0], sampleRate, 128);
  } finally {
    decoder.free();
  }
}
