import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import { put, list } from "@vercel/blob";
import { classifyMediaKind, needsOpusConversion } from "../lib/shared.js";

const SOURCE_DIR = process.argv[2] || "/Users/jonathansilva/Downloads/acertottk";

const SKIP_SEED_KEYS = new Set([
  "f1936a7df17d", // Registro em vídeo do TTK #3
  "d950691a306c", // Óculos na régua e copo americano na mão
]);

const CUSTOM_CAPTIONS = {
  "WhatsApp Image 2026-11-21 at 18.19.17.jpeg":
    "Saindo da MP Conveniência com a caixa vermelha de 24 burdoguinhas debaixo do braço",
  "WhatsApp Image 2026-11-21 at 18.19.18 (1).jpeg":
    "Capacete amarelo e sorriso de quem acabou de garantir o estoque",
  "WhatsApp Image 2026-11-21 at 18.19.17 (1).jpeg":
    "Caneca suando na mesa de madeira com a rapaziada na rua",
  "WhatsApp Image 2026-11-21 at 18.19.15 (1).jpeg":
    "Cadeira giratória, JBL na janela e latinha gelada",
  "WhatsApp Image 2026-11-21 at 18.19.16.jpeg":
    "Relíquia das antigas: olhar atento antes mesmo da primeira caixa de 24",
  "WhatsApp Image 2026-11-21 at 18.19.16 (1).jpeg":
    "Perfil aerodinâmico pós-corte na régua",
  "WhatsApp Image 2026-11-21 at 18.19.18.jpeg":
    "Madrugada de boné e resenha das antigas",
  "WhatsApp Image 2026-11-21 at 18.19.18 (2).jpeg":
    "Direto do arquivo confidencial do @dixx_do_ttk",
  "duttkaudio1.mp3": "Pérola clássica do TTK #1",
  "velhotexas.mp3": "Velho texas",
};

const FEATURED_OVERRIDES = {
  "velhotexas.mp3": {
    featured: true,
    featuredBadge: "⭐⭐⭐⭐⭐ Menção Honrosa",
    featuredNote: "Participação lendária do Du — patrimônio tombado no topo oficial do acervo.",
    author: "Du",
  },
};

function mimeForExt(ext) {
  switch (ext.toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".wav":
      return "audio/wav";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

async function fetchExistingSeedKeys() {
  const keys = new Set();
  let cursor;
  do {
    const page = await list({ prefix: "items/", cursor });
    for (const b of page.blobs) {
      const res = await fetch(b.url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.seedKey) keys.add(data.seedKey);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN ausente no ambiente.");
  }

  const entries = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => !f.startsWith("."))
    .sort((a, b) => a.localeCompare(b));

  const existingKeys = await fetchExistingSeedKeys();
  console.log(`Encontrados ${entries.length} arquivos em ${SOURCE_DIR} (${existingKeys.size} já semeados).`);

  let videoNum = 0;
  let audioNum = 1;
  let imageNum = 0;
  const baseEpoch = Date.now() - entries.length * 1000;

  for (let idx = 0; idx < entries.length; idx++) {
    const filename = entries[idx];
    const seedKey = createHash("sha1").update(filename).digest("hex").slice(0, 12);

    if (SKIP_SEED_KEYS.has(seedKey) || existingKeys.has(seedKey)) {
      console.log(`Pulando ignorado ou já existente: ${filename}`);
      continue;
    }

    const fullPath = path.join(SOURCE_DIR, filename);
    let uploadBuffer;
    let finalExt;

    if (needsOpusConversion(filename, "")) {
      const tmpOut = path.join(os.tmpdir(), `ttk-${seedKey}.mp3`);
      execFileSync(ffmpegPath, [
        "-y",
        "-i",
        fullPath,
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "128k",
        tmpOut,
      ]);
      uploadBuffer = fs.readFileSync(tmpOut);
      fs.unlinkSync(tmpOut);
      finalExt = ".mp3";
      console.log(`Convertido .opus -> .mp3: ${filename} (${uploadBuffer.byteLength} bytes)`);
    } else {
      uploadBuffer = fs.readFileSync(fullPath);
      finalExt = path.extname(filename).toLowerCase() || ".jpeg";
    }

    const mimeType = mimeForExt(finalExt);
    const kind = classifyMediaKind(mimeType);

    let caption = CUSTOM_CAPTIONS[filename];
    if (!caption) {
      if (kind === "video") {
        videoNum += 1;
        caption = `Registro em vídeo do TTK #${videoNum}`;
      } else if (kind === "audio") {
        audioNum += 1;
        caption = `Áudio de WhatsApp do TTK #${audioNum}`;
      } else {
        imageNum += 1;
        caption = `Foto do acervo #${imageNum}`;
      }
    }

    const mediaBlob = await put(`media/seed-${seedKey}${finalExt}`, uploadBuffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: mimeType,
    });

    const ts = baseEpoch + idx * 1000;
    const special = FEATURED_OVERRIDES[filename] || {};
    const item = {
      id: `seed${seedKey}`,
      seedKey,
      author: special.author || "Acervo Oficial",
      caption,
      kind,
      mediaUrl: mediaBlob.url,
      mimeType,
      createdAt: new Date(ts).toISOString(),
      approvedAt: new Date(ts).toISOString(),
      ...(special.featured
        ? {
            featured: true,
            featuredBadge: special.featuredBadge,
            featuredNote: special.featuredNote,
          }
        : {}),
    };

    await put(`items/${ts}-${item.id}.json`, JSON.stringify(item), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    console.log(`Semeado [${kind}]: ${caption} -> ${mediaBlob.url}`);
  }

  console.log("Seed concluído!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
