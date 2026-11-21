import { Mp3Encoder } from "@breezystack/lamejs";
import { OggOpusDecoder } from "ogg-opus-decoder";

function floatToInt16(samplesFloat32) {
  const pcm16 = new Int16Array(samplesFloat32.length);
  for (let i = 0; i < samplesFloat32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samplesFloat32[i]));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm16;
}

export function encodePcmToMp3(leftFloat32, sampleRate = 48000, kbps = 128, rightFloat32 = null) {
  const isStereo = Boolean(rightFloat32 && rightFloat32.length === leftFloat32.length);
  const left16 = floatToInt16(leftFloat32);
  const right16 = isStereo ? floatToInt16(rightFloat32) : null;

  const encoder = new Mp3Encoder(isStereo ? 2 : 1, sampleRate, kbps);
  const chunks = [];
  const frameSize = 1152;

  for (let offset = 0; offset < left16.length; offset += frameSize) {
    const leftSlice = left16.subarray(offset, offset + frameSize);
    const buf = isStereo
      ? encoder.encodeBuffer(leftSlice, right16.subarray(offset, offset + frameSize))
      : encoder.encodeBuffer(leftSlice);
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
    const rightChannel = channelData.length >= 2 ? channelData[1] : null;
    return encodePcmToMp3(channelData[0], sampleRate, 128, rightChannel);
  } finally {
    decoder.free();
  }
}
