import { upload } from "@vercel/blob/client";
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES, needsOpusConversion } from "../lib/shared.js";

const CRATE_SIZE = 24;
const INTRO_SEEN_KEY = "acervo_ttk_intro_seen";
const INTRO_DURATION_MS = 10400;
const INTRO_EXIT_MS = 720;

const introStage = document.getElementById("introStage");
const introBeamsPrimary = document.getElementById("introBeamsPrimary");
const introBeamsSecondary = document.getElementById("introBeamsSecondary");
const introBeerField = document.getElementById("introBeerField");
const introSoundBtn = document.getElementById("introSoundBtn");
const introProgressBar = document.getElementById("introProgressBar");
const introAudio = document.getElementById("introAudio");
const skipIntroBtn = document.getElementById("skipIntroBtn");
const replayIntroBtn = document.getElementById("replayIntroBtn");

const galleryStatus = document.getElementById("galleryStatus");
const featuredSection = document.getElementById("featuredSection");
const featuredSlot = document.getElementById("featuredSlot");
const audioSection = document.getElementById("audioSection");
const audioGrid = document.getElementById("audioGrid");
const visualSection = document.getElementById("visualSection");
const visualHeading = document.getElementById("visualHeading");
const mediaGrid = document.getElementById("mediaGrid");

const crateHeading = document.getElementById("crateHeading");
const crateCount = document.getElementById("crateCount");
const crateGrid = document.getElementById("crateGrid");
const crateNote = document.getElementById("crateNote");

const countAll = document.getElementById("countAll");
const countVideo = document.getElementById("countVideo");
const countAudio = document.getElementById("countAudio");
const countImage = document.getElementById("countImage");
const filterButtons = document.querySelectorAll(".filter-btn");

const openUploadBtn = document.getElementById("openUploadBtn");
const closeUploadBtn = document.getElementById("closeUploadBtn");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const uploadDialog = document.getElementById("uploadDialog");
const uploadForm = document.getElementById("uploadForm");
const authorInput = document.getElementById("authorInput");
const captionInput = document.getElementById("captionInput");
const fileInput = document.getElementById("fileInput");
const websiteInput = document.getElementById("websiteInput");
const uploadStatus = document.getElementById("uploadStatus");
const submitUploadBtn = document.getElementById("submitUploadBtn");

const lightboxDialog = document.getElementById("lightboxDialog");
const closeLightboxBtn = document.getElementById("closeLightboxBtn");
const lightboxStage = document.getElementById("lightboxStage");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxAuthor = document.getElementById("lightboxAuthor");

const reviewBanner = document.getElementById("reviewBanner");
const reviewMeta = document.getElementById("reviewMeta");
const reviewPreview = document.getElementById("reviewPreview");
const reviewCaption = document.getElementById("reviewCaption");
const reviewActions = document.getElementById("reviewActions");
const approveBtn = document.getElementById("approveBtn");
const rejectBtn = document.getElementById("rejectBtn");
const reviewFeedback = document.getElementById("reviewFeedback");

let allItems = [];
let activeFilter = "all";
let activeAudioEl = null;
let activeAudioCard = null;
let activeAudioBtn = null;

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function renderCrate(total) {
  const completedCrates = Math.floor(total / CRATE_SIZE);
  const currentCrateNumber = completedCrates + 1;
  const filledInCurrent = total === 0 ? 0 : total % CRATE_SIZE || CRATE_SIZE;

  crateHeading.textContent = `Caixa #${currentCrateNumber} de 24`;
  crateCount.textContent = `${filledInCurrent}/24 burdoguinhas (${total} no total)`;
  crateNote.textContent =
    completedCrates > 0
      ? `${completedCrates} ${completedCrates === 1 ? "caixa completa" : "caixas completas"} até agora.`
      : "Cada item publicado preenche uma garrafa da caixa.";

  crateGrid.replaceChildren();
  for (let i = 0; i < CRATE_SIZE; i++) {
    const slot = document.createElement("span");
    slot.className = i < filledInCurrent ? "bottle-slot is-filled" : "bottle-slot";
    crateGrid.appendChild(slot);
  }
}

function updateCounts() {
  const videos = allItems.filter((i) => i.kind === "video").length;
  const audios = allItems.filter((i) => i.kind === "audio").length;
  const images = allItems.filter((i) => i.kind === "image").length;

  countAll.textContent = String(allItems.length);
  countVideo.textContent = String(videos);
  countAudio.textContent = String(audios);
  countImage.textContent = String(images);
}

function pauseActiveAudio() {
  if (activeAudioEl) {
    activeAudioEl.pause();
  }
  if (activeAudioCard) {
    activeAudioCard.classList.remove("is-playing");
  }
  if (activeAudioBtn) {
    activeAudioBtn.textContent = "▶";
  }
  activeAudioEl = null;
  activeAudioCard = null;
  activeAudioBtn = null;
}

function createAudioCard(item) {
  const card = document.createElement("article");
  card.className = "audio-card";

  const top = document.createElement("div");
  top.className = "audio-top";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "audio-play-btn";
  btn.textContent = "▶";
  btn.setAttribute("aria-label", "Tocar ou pausar áudio");

  const info = document.createElement("div");
  info.className = "audio-info";

  const cap = document.createElement("p");
  cap.className = "audio-caption";
  cap.textContent = item.caption || "Áudio do TTK";

  const meta = document.createElement("p");
  meta.className = "audio-author";
  const datePart = formatDate(item.createdAt);
  meta.textContent = datePart ? `Por ${item.author} em ${datePart}` : `Por ${item.author}`;

  info.append(cap, meta);
  top.append(btn, info);

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  audio.src = item.mediaUrl;

  btn.addEventListener("click", () => {
    if (audio.paused) {
      if (activeAudioEl && activeAudioEl !== audio) {
        pauseActiveAudio();
      }
      audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener("play", () => {
    if (activeAudioEl && activeAudioEl !== audio) {
      pauseActiveAudio();
    }
    activeAudioEl = audio;
    activeAudioCard = card;
    activeAudioBtn = btn;
    card.classList.add("is-playing");
    btn.textContent = "❚❚";
  });

  const onStop = () => {
    card.classList.remove("is-playing");
    btn.textContent = "▶";
  };
  audio.addEventListener("pause", onStop);
  audio.addEventListener("ended", onStop);

  card.append(top, audio);
  return card;
}

function createFeaturedAudioCard(item) {
  const card = document.createElement("article");
  card.className = "featured-card";

  const ribbon = document.createElement("div");
  ribbon.className = "featured-ribbon";
  ribbon.textContent = item.featuredBadge || "⭐⭐⭐⭐⭐ Menção Honrosa";

  const main = document.createElement("div");
  main.className = "featured-main";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "audio-play-btn featured-play-btn";
  btn.textContent = "▶";
  btn.setAttribute("aria-label", "Tocar ou pausar áudio lendário");

  const info = document.createElement("div");
  info.className = "audio-info";

  const title = document.createElement("h2");
  title.className = "featured-title";
  title.textContent = item.caption || "Velho texas";

  const sub = document.createElement("p");
  sub.className = "featured-sub";
  sub.textContent =
    item.featuredNote ||
    (item.author && item.author !== "Acervo Oficial"
      ? `Áudio clássico do ${item.author}`
      : "Clássico do acervo");

  info.append(title, sub);
  main.append(btn, info);

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "metadata";
  audio.src = item.mediaUrl;

  btn.addEventListener("click", () => {
    if (audio.paused) {
      if (activeAudioEl && activeAudioEl !== audio) {
        pauseActiveAudio();
      }
      audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener("play", () => {
    if (activeAudioEl && activeAudioEl !== audio) {
      pauseActiveAudio();
    }
    activeAudioEl = audio;
    activeAudioCard = card;
    activeAudioBtn = btn;
    card.classList.add("is-playing");
    btn.textContent = "❚❚";
  });

  const onStop = () => {
    card.classList.remove("is-playing");
    btn.textContent = "▶";
  };
  audio.addEventListener("pause", onStop);
  audio.addEventListener("ended", onStop);

  card.append(ribbon, main, audio);
  return card;
}

function openLightbox(item) {
  pauseActiveAudio();
  lightboxStage.replaceChildren();

  if (item.kind === "video") {
    const video = document.createElement("video");
    video.src = item.mediaUrl;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    lightboxStage.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = item.mediaUrl;
    img.alt = item.caption || "Foto do acervo TTK";
    lightboxStage.appendChild(img);
  }

  lightboxCaption.textContent = item.caption || "";
  const datePart = formatDate(item.createdAt);
  lightboxAuthor.textContent = datePart ? `Enviado por ${item.author} em ${datePart}` : `Enviado por ${item.author}`;
  lightboxDialog.showModal();
}

function createVisualCard(item) {
  const fig = document.createElement("figure");
  fig.className = "media-card";

  const thumbBtn = document.createElement("button");
  thumbBtn.type = "button";
  thumbBtn.className = "media-thumb-btn";
  thumbBtn.addEventListener("click", () => openLightbox(item));

  if (item.kind === "video") {
    const video = document.createElement("video");
    video.src = `${item.mediaUrl}#t=0.1`;
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const pill = document.createElement("span");
    pill.className = "video-pill";
    pill.textContent = "▶ Vídeo";

    thumbBtn.append(video, pill);
  } else {
    const img = document.createElement("img");
    img.src = item.mediaUrl;
    img.loading = "lazy";
    img.alt = item.caption || "Foto do acervo TTK";
    thumbBtn.appendChild(img);
  }

  const body = document.createElement("figcaption");
  body.className = "media-body";

  const cap = document.createElement("p");
  cap.className = "media-caption";
  cap.textContent = item.caption || "Relíquia do TTK";

  const auth = document.createElement("p");
  auth.className = "media-author";
  auth.textContent = `Enviado por ${item.author}`;

  body.append(cap, auth);
  fig.append(thumbBtn, body);
  return fig;
}

function renderGallery() {
  pauseActiveAudio();
  featuredSlot.replaceChildren();
  audioGrid.replaceChildren();
  mediaGrid.replaceChildren();

  const featuredItems = allItems.filter((item) => item.featured && item.kind === "audio");
  if (featuredItems.length > 0) {
    featuredSection.hidden = false;
    featuredItems.forEach((item) => featuredSlot.appendChild(createFeaturedAudioCard(item)));
  } else {
    featuredSection.hidden = true;
  }

  const regularItems = allItems.filter((item) => !(item.featured && item.kind === "audio"));
  const filtered =
    activeFilter === "all" ? regularItems : regularItems.filter((item) => item.kind === activeFilter);

  if (filtered.length === 0 && featuredSection.hidden) {
    audioSection.hidden = true;
    visualSection.hidden = true;
    galleryStatus.hidden = false;
    galleryStatus.textContent =
      allItems.length === 0
        ? "O engradado ainda está vazio. Mande a primeira lembrança!"
        : "Nenhuma lembrança nessa categoria ainda.";
    return;
  }

  galleryStatus.hidden = true;

  const audios = filtered.filter((item) => item.kind === "audio");
  const visuals = filtered.filter((item) => item.kind !== "audio");

  if (audios.length > 0) {
    audioSection.hidden = false;
    audios.forEach((item) => audioGrid.appendChild(createAudioCard(item)));
  } else {
    audioSection.hidden = true;
  }

  if (visuals.length > 0) {
    visualSection.hidden = false;
    visualHeading.textContent =
      activeFilter === "video" ? "Vídeos" : activeFilter === "image" ? "Fotos" : "Fotos e vídeos";
    visuals.forEach((item) => mediaGrid.appendChild(createVisualCard(item)));
  } else {
    visualSection.hidden = true;
  }
}

async function loadItems() {
  try {
    const res = await fetch("/api/items", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allItems = Array.isArray(data.items) ? data.items : [];
    renderCrate(allItems.length);
    updateCounts();
    renderGallery();
  } catch {
    galleryStatus.hidden = false;
    galleryStatus.textContent = "Não deu pra carregar o acervo agora. Recarregue a página em instantes.";
  }
}

function sanitizeBaseFilename(name) {
  return (
    String(name || "arquivo")
      .replace(/(\.mp3)?\.(opus|ogg|oga)$/i, "")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "reliquia"
  );
}

function inferMimeType(file) {
  if (file.type && ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return file.type || "";
}

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
};

async function prepareUploadFile(file, setStatus) {
  if (needsOpusConversion(file.name, file.type)) {
    setStatus("Convertendo áudio do WhatsApp (.opus) para .mp3...");
    const { transcodeOpusBytesToMp3 } = await import("./opus-to-mp3.js");
    const buf = new Uint8Array(await file.arrayBuffer());
    const mp3Bytes = await transcodeOpusBytesToMp3(buf);
    const mp3Name = `${sanitizeBaseFilename(file.name)}.mp3`;
    return new File([mp3Bytes], mp3Name, { type: "audio/mpeg" });
  }

  const mime = inferMimeType(file);
  if (!ALLOWED_CONTENT_TYPES.includes(mime)) {
    throw new Error("Formato não suportado. Envie MP4, MOV, MP3, OPUS, M4A, JPG, PNG ou WEBP.");
  }
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : EXT_BY_MIME[mime] || "";
  const safeName = `${sanitizeBaseFilename(file.name)}${ext}`;
  return new File([file], safeName, { type: mime });
}

async function handleSubmission(event) {
  event.preventDefault();
  const rawFile = fileInput.files?.[0];
  if (!rawFile) return;

  if (rawFile.size > MAX_UPLOAD_BYTES) {
    uploadStatus.hidden = false;
    uploadStatus.textContent = "O arquivo passa de 50 MB. Escolha um vídeo mais curto.";
    return;
  }

  const setStatus = (msg) => {
    uploadStatus.hidden = false;
    uploadStatus.textContent = msg;
  };

  submitUploadBtn.disabled = true;

  try {
    const preparedFile = await prepareUploadFile(rawFile, setStatus);

    setStatus("Enviando arquivo...");
    const blob = await upload(`media/${preparedFile.name}`, preparedFile, {
      access: "public",
      contentType: preparedFile.type,
      handleUploadUrl: "/api/upload",
      clientPayload: JSON.stringify({ website: websiteInput.value || "" }),
    });

    setStatus("Finalizando envio...");
    const subRes = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: authorInput.value,
        caption: captionInput.value,
        mediaUrl: blob.url,
        mimeType: preparedFile.type,
        website: websiteInput.value || "",
      }),
    });

    const subJson = await subRes.json().catch(() => ({}));
    if (!subRes.ok) {
      throw new Error(subJson.error || "Não foi possível registrar o envio.");
    }

    uploadForm.reset();
    setStatus("Enviado! Assim que for aprovado, aparece aqui na galeria.");
  } catch (err) {
    setStatus(err.message || "Erro ao enviar arquivo.");
  } finally {
    submitUploadBtn.disabled = false;
  }
}

async function initModerationBanner() {
  const params = new URLSearchParams(window.location.search);
  const reviewId = params.get("review");
  const token = params.get("token");
  if (!reviewId || !token) return;

  reviewBanner.hidden = false;
  reviewMeta.textContent = "Carregando envio pendente...";
  reviewActions.hidden = true;

  try {
    const res = await fetch(
      `/api/review?id=${encodeURIComponent(reviewId)}&token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      reviewMeta.textContent = data.error || "Link de revisão inválido.";
      return;
    }

    if (data.status === "already_processed") {
      reviewMeta.textContent = "Este envio já foi revisado anteriormente.";
      return;
    }

    const { item } = data;
    reviewMeta.textContent = `Enviado por ${item.author} (${item.kind})`;
    reviewCaption.textContent = item.caption || "(sem legenda)";
    reviewPreview.replaceChildren();

    if (item.kind === "video") {
      const v = document.createElement("video");
      v.src = item.mediaUrl;
      v.controls = true;
      v.playsInline = true;
      reviewPreview.appendChild(v);
    } else if (item.kind === "audio") {
      const a = document.createElement("audio");
      a.src = item.mediaUrl;
      a.controls = true;
      reviewPreview.appendChild(a);
    } else {
      const img = document.createElement("img");
      img.src = item.mediaUrl;
      img.alt = item.caption || "Prévia do envio";
      reviewPreview.appendChild(img);
    }

    reviewActions.hidden = false;

    const runAction = async (action) => {
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      reviewFeedback.hidden = false;
      reviewFeedback.textContent =
        action === "approve" ? "Publicando no site oficial..." : "Apagando envio rejeitado...";

      try {
        const actRes = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: reviewId, token, action }),
        });
        const actData = await actRes.json().catch(() => ({}));

        if (!actRes.ok) {
          reviewFeedback.textContent = actData.error || "Falha ao processar revisão.";
          approveBtn.disabled = false;
          rejectBtn.disabled = false;
          return;
        }

        reviewActions.hidden = true;
        if (actData.status === "approved") {
          reviewFeedback.textContent = "Aprovado! A lembrança já está publicada na galeria oficial abaixo.";
          await loadItems();
        } else if (actData.status === "rejected") {
          reviewPreview.replaceChildren();
          reviewFeedback.textContent = "Envio rejeitado e arquivo removido do Vercel Blob.";
        } else {
          reviewFeedback.textContent = "Este envio já havia sido revisado.";
        }
      } catch {
        reviewFeedback.textContent = "Erro de conexão ao processar revisão. Tente novamente.";
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
      }
    };

    approveBtn.addEventListener("click", () => runAction("approve"));
    rejectBtn.addEventListener("click", () => runAction("reject"));
  } catch {
    reviewMeta.textContent = "Erro ao consultar envio pendente.";
  }
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    filterButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
    renderGallery();
  });
});

openUploadBtn.addEventListener("click", () => {
  uploadStatus.hidden = true;
  uploadDialog.showModal();
});

const closeUpload = () => uploadDialog.close();
closeUploadBtn.addEventListener("click", closeUpload);
cancelUploadBtn.addEventListener("click", closeUpload);
uploadDialog.addEventListener("click", (e) => {
  if (e.target === uploadDialog) closeUpload();
});

const closeLightbox = () => {
  lightboxStage.replaceChildren();
  lightboxDialog.close();
};
closeLightboxBtn.addEventListener("click", closeLightbox);
lightboxDialog.addEventListener("close", () => lightboxStage.replaceChildren());
lightboxDialog.addEventListener("click", (e) => {
  if (e.target === lightboxDialog) closeLightbox();
});

uploadForm.addEventListener("submit", handleSubmission);

const SVG_NS = "http://www.w3.org/2000/svg";
let introTimer = null;
let introExitTimer = null;
let audioFadeTimer = null;

const BEER_BRANDS = [
  { name: "BRAHMA", shape: "stubby", glass: "#6b3310", foil: "#e5b546", cap: "#d62828", labelBg: "#d62828", labelTrim: "#f4c542", text: "#ffffff" },
  { name: "SKOL", shape: "can", bodyTop: "#f7c927", bodyBot: "#e0a800", badge: "#d92b2b", text: "#ffffff" },
  { name: "HEINEKEN", shape: "bottle", glass: "#136f3a", foil: "#dce3e6", cap: "#136f3a", labelBg: "#115c30", labelTrim: "#ffffff", text: "#ffffff", star: "#e02424" },
  { name: "ANTARCTICA", shape: "stubby", glass: "#6b3310", foil: "#1e62b5", cap: "#1e62b5", labelBg: "#f5f3ec", labelTrim: "#1e62b5", text: "#103c78" },
  { name: "ORIGINAL", shape: "stubby", glass: "#662f0d", foil: "#f4ebd6", cap: "#c92a2a", labelBg: "#f6eed9", labelTrim: "#c92a2a", text: "#1c1815" },
  { name: "SUBZERO", shape: "stubby", glass: "#5e2b0d", foil: "#38a3e8", cap: "#197bbd", labelBg: "#eaf6ff", labelTrim: "#d62828", text: "#0d4470" },
  { name: "SPATEN", shape: "can", bodyTop: "#1a5632", bodyBot: "#103b21", badge: "#cfa349", text: "#ffffff" },
  { name: "BUD", shape: "bottle", glass: "#6b3310", foil: "#d92b2b", cap: "#d92b2b", labelBg: "#ffffff", labelTrim: "#d92b2b", text: "#b81d1d" },
  { name: "CORONA", shape: "bottle", glass: "#e8b339", foil: "#ffffff", cap: "#173c73", labelBg: "#ffffff", labelTrim: "#173c73", text: "#173c73", lime: true },
  { name: "AMSTEL", shape: "can", bodyTop: "#d62828", bodyBot: "#f5f5f5", badge: "#c99b3b", text: "#1a1412" },
  { name: "ITAIPAVA", shape: "stubby", glass: "#6b3310", foil: "#d4a638", cap: "#c92a2a", labelBg: "#ffffff", labelTrim: "#c92a2a", text: "#9e1b1b" },
];

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

function createBeerSvg(brand) {
  const svg = svgEl("svg", { viewBox: "0 0 90 170", "aria-hidden": "true" });

  if (brand.shape === "can") {
    svg.append(
      svgEl("rect", { x: 18, y: 24, width: 54, height: 6, rx: 3, fill: "#cfd6dc" }),
      svgEl("rect", { x: 15, y: 30, width: 60, height: 62, rx: 8, fill: brand.bodyTop }),
      svgEl("rect", { x: 15, y: 84, width: 60, height: 58, rx: 8, fill: brand.bodyBot }),
      svgEl("rect", { x: 18, y: 140, width: 54, height: 6, rx: 3, fill: "#b8c0c8" }),
      svgEl("circle", { cx: 45, cy: 84, r: 21, fill: brand.badge, stroke: "#fff", "stroke-width": 2 }),
      svgEl("rect", { x: 21, y: 34, width: 7, height: 102, rx: 3, fill: "rgba(255,255,255,0.24)" })
    );
    const txt = svgEl("text", {
      x: 45,
      y: 88,
      "text-anchor": "middle",
      fill: brand.text,
      "font-family": "Barlow Condensed, sans-serif",
      "font-weight": "800",
      "font-size": brand.name.length > 6 ? "11.5" : "14",
    });
    txt.textContent = brand.name;
    svg.appendChild(txt);
    return svg;
  }

  const isStubby = brand.shape === "stubby";
  const bodyY = isStubby ? 64 : 58;
  const bodyH = isStubby ? 88 : 96;
  const bodyX = isStubby ? 14 : 20;
  const bodyW = isStubby ? 62 : 50;

  if (brand.lime) {
    svg.appendChild(svgEl("circle", { cx: 52, cy: 14, r: 10, fill: "#69b836", stroke: "#d9f59d", "stroke-width": 2 }));
  }

  // Cap + neck + foil + bottle body + highlight
  svg.append(
    svgEl("rect", { x: 35, y: 12, width: 20, height: 7, rx: 3, fill: brand.cap }),
    svgEl("path", {
      d: isStubby
        ? "M36,19 L54,19 L57,46 C68,54 76,62 76,72 L76,144 C76,151 70,156 63,156 L27,156 C20,156 14,151 14,144 L14,72 C14,62 22,54 33,46 Z"
        : "M37,19 L53,19 L55,50 C64,58 70,66 70,76 L70,146 C70,152 65,156 59,156 L31,156 C25,156 20,152 20,146 L20,76 C20,66 26,58 35,50 Z",
      fill: brand.glass,
      stroke: "rgba(255,255,255,0.22)",
      "stroke-width": 1.5,
    }),
    svgEl("path", {
      d: isStubby ? "M35,19 L55,19 L56,38 L34,38 Z" : "M36,19 L54,19 L55,40 L35,40 Z",
      fill: brand.foil,
    }),
    svgEl("rect", {
      x: bodyX + 3,
      y: bodyY + 14,
      width: bodyW - 6,
      height: 44,
      rx: 5,
      fill: brand.labelBg,
      stroke: brand.labelTrim,
      "stroke-width": 3,
    }),
    svgEl("rect", {
      x: bodyX + 7,
      y: bodyY + 4,
      width: 6,
      height: bodyH - 18,
      rx: 3,
      fill: "rgba(255,255,255,0.22)",
    })
  );

  if (brand.star) {
    svg.appendChild(
      svgEl("polygon", {
        points: "45,82 47.5,88 54,88 48.8,91.8 50.8,98 45,94.2 39.2,98 41.2,91.8 36,88 42.5,88",
        fill: brand.star,
      })
    );
  }

  const txt = svgEl("text", {
    x: 45,
    y: brand.star ? bodyY + 51 : bodyY + 41,
    "text-anchor": "middle",
    fill: brand.text,
    "font-family": "Barlow Condensed, sans-serif",
    "font-weight": "800",
    "font-size": brand.name.length > 7 ? "10.5" : "13.5",
    "letter-spacing": "0.5",
  });
  txt.textContent = brand.name;
  svg.appendChild(txt);
  return svg;
}

function buildFlyingBeers() {
  if (!introBeerField) return;
  introBeerField.replaceChildren();

  const totalBeers = 24;
  for (let i = 0; i < totalBeers; i++) {
    const brand = BEER_BRANDS[i % BEER_BRANDS.length];
    const wrap = document.createElement("div");
    wrap.className = "flying-beer";

    const isRadialWarp = i % 2 === 0;
    if (isRadialWarp) {
      const angle = ((i / totalBeers) * 360 + (i % 3) * 17) * (Math.PI / 180);
      const dist = 560 + (i % 4) * 120;
      wrap.style.setProperty("--x0", "50%");
      wrap.style.setProperty("--y0", "50%");
      wrap.style.setProperty("--dx", `${Math.round(Math.cos(angle) * dist)}px`);
      wrap.style.setProperty("--dy", `${Math.round(Math.sin(angle) * dist)}px`);
      wrap.style.setProperty("--s0", "0.18");
      wrap.style.setProperty("--s1", (1.05 + (i % 4) * 0.18).toFixed(2));
    } else {
      const fromLeft = i % 4 === 1;
      const startY = 12 + ((i * 19) % 76);
      const driftY = ((i % 5) - 2) * 140;
      wrap.style.setProperty("--x0", fromLeft ? "-8%" : "108%");
      wrap.style.setProperty("--y0", `${startY}%`);
      wrap.style.setProperty("--dx", fromLeft ? "118vw" : "-118vw");
      wrap.style.setProperty("--dy", `${driftY}px`);
      wrap.style.setProperty("--s0", (0.72 + (i % 3) * 0.16).toFixed(2));
      wrap.style.setProperty("--s1", (0.95 + (i % 3) * 0.16).toFixed(2));
    }

    const sizePx = 62 + (i % 4) * 11;
    const durSec = (3.4 + (i % 5) * 0.55).toFixed(2);
    const delaySec = ((i * 0.37) % 3.6).toFixed(2);
    const rotStart = (i * 33) % 360;
    const rotEnd = rotStart + (i % 2 === 0 ? 320 : -320);

    wrap.style.setProperty("--size", `${sizePx}px`);
    wrap.style.setProperty("--dur", `${durSec}s`);
    wrap.style.setProperty("--delay", `${delaySec}s`);
    wrap.style.setProperty("--r0", `${rotStart}deg`);
    wrap.style.setProperty("--r1", `${rotEnd}deg`);

    wrap.appendChild(createBeerSvg(brand));
    introBeerField.appendChild(wrap);
  }
}

function buildTriangularBeams() {
  if (!introBeamsPrimary || introBeamsPrimary.childElementCount > 0) return;

  const radius = 2200;
  const primaryCount = 16;
  const stepDeg = 360 / primaryCount;
  const wedgeSpanDeg = 13.5;

  for (let i = 0; i < primaryCount; i++) {
    const startRad = ((i * stepDeg - wedgeSpanDeg / 2) * Math.PI) / 180;
    const endRad = ((i * stepDeg + wedgeSpanDeg / 2) * Math.PI) / 180;
    const x1 = (Math.cos(startRad) * radius).toFixed(1);
    const y1 = (Math.sin(startRad) * radius).toFixed(1);
    const x2 = (Math.cos(endRad) * radius).toFixed(1);
    const y2 = (Math.sin(endRad) * radius).toFixed(1);

    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", `0,0 ${x1},${y1} ${x2},${y2}`);
    poly.setAttribute("fill", i % 2 === 0 ? "url(#beamRedGrad)" : "url(#beamGoldGrad)");
    poly.setAttribute("class", "beam-wedge");
    poly.style.setProperty("--i", String(i));
    introBeamsPrimary.appendChild(poly);
  }

  const secondaryCount = 8;
  const secStepDeg = 360 / secondaryCount;
  const secSpanDeg = 5;

  for (let j = 0; j < secondaryCount; j++) {
    const baseDeg = j * secStepDeg + stepDeg / 2;
    const sRad = ((baseDeg - secSpanDeg / 2) * Math.PI) / 180;
    const eRad = ((baseDeg + secSpanDeg / 2) * Math.PI) / 180;
    const x1 = (Math.cos(sRad) * radius).toFixed(1);
    const y1 = (Math.sin(sRad) * radius).toFixed(1);
    const x2 = (Math.cos(eRad) * radius).toFixed(1);
    const y2 = (Math.sin(eRad) * radius).toFixed(1);

    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", `0,0 ${x1},${y1} ${x2},${y2}`);
    poly.setAttribute("fill", "rgba(255, 244, 214, 0.16)");
    poly.setAttribute("class", "beam-wedge");
    poly.style.setProperty("--i", String(j));
    introBeamsSecondary.appendChild(poly);
  }
}

function fadeOutIntroAudio() {
  window.clearInterval(audioFadeTimer);
  if (!introAudio || introAudio.paused) return;

  audioFadeTimer = window.setInterval(() => {
    if (introAudio.volume > 0.12) {
      introAudio.volume = Math.max(0, introAudio.volume - 0.12);
    } else {
      window.clearInterval(audioFadeTimer);
      introAudio.pause();
      introAudio.currentTime = 0;
      introAudio.volume = 0.9;
    }
  }, 55);
}

function startIntroClock(durationMs) {
  window.clearTimeout(introTimer);
  if (introProgressBar) {
    introProgressBar.classList.remove("is-running");
    introProgressBar.style.setProperty("--intro-ms", `${durationMs}ms`);
    void introProgressBar.offsetWidth;
    introProgressBar.classList.add("is-running");
  }
  introTimer = window.setTimeout(() => {
    finishIntro();
  }, durationMs);
}

function finishIntro() {
  window.clearTimeout(introTimer);
  window.clearTimeout(introExitTimer);
  if (!introStage || introStage.hidden) return;

  fadeOutIntroAudio();
  introStage.classList.add("is-exiting");
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Ignore storage restrictions.
  }

  introExitTimer = window.setTimeout(() => {
    introStage.hidden = true;
    introStage.classList.remove("is-exiting");
  }, INTRO_EXIT_MS);
}

async function tryStartIntroAudio() {
  if (!introAudio) {
    startIntroClock(INTRO_DURATION_MS);
    return;
  }
  window.clearInterval(audioFadeTimer);
  introAudio.volume = 0.9;
  introAudio.currentTime = 0;

  try {
    await introAudio.play();
    if (introSoundBtn) introSoundBtn.hidden = true;
    startIntroClock(INTRO_DURATION_MS);
  } catch {
    // Browser blocked unmuted autoplay on cold load: show 1-click sound button and keep clock running.
    if (introSoundBtn) introSoundBtn.hidden = false;
    startIntroClock(INTRO_DURATION_MS);
  }
}

function playIntro(force = false) {
  if (!introStage) return;

  const params = new URLSearchParams(window.location.search);
  const isReviewLink = params.has("review") && params.has("token");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let alreadySeen = false;
  try {
    alreadySeen = window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    alreadySeen = false;
  }

  if (!force && (isReviewLink || reducedMotion || (alreadySeen && !params.has("intro")))) {
    introStage.hidden = true;
    return;
  }

  window.clearTimeout(introTimer);
  window.clearTimeout(introExitTimer);

  introBeamsPrimary?.replaceChildren();
  introBeamsSecondary?.replaceChildren();
  buildTriangularBeams();
  buildFlyingBeers();

  introStage.classList.remove("is-exiting");
  introStage.hidden = false;

  tryStartIntroAudio();
}

introSoundBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  introSoundBtn.hidden = true;
  if (introAudio) {
    window.clearInterval(audioFadeTimer);
    introAudio.volume = 0.9;
    introAudio.currentTime = 0;
    introAudio.play().catch(() => {});
  }
  // Restart full 10.4s show from the bottle-cap pop so they get the whole experience!
  startIntroClock(INTRO_DURATION_MS);
});

introStage?.addEventListener("click", (e) => {
  if (e.target === skipIntroBtn || e.target === introSoundBtn) return;
  if (introAudio && introAudio.paused && introSoundBtn && !introSoundBtn.hidden) {
    introSoundBtn.click();
  }
});

skipIntroBtn?.addEventListener("click", finishIntro);
replayIntroBtn?.addEventListener("click", () => playIntro(true));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && introStage && !introStage.hidden) {
    finishIntro();
  }
});

playIntro(false);
initModerationBanner();
loadItems();
