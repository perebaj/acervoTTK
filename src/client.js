import { upload } from "@vercel/blob/client";
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES, needsOpusConversion } from "../lib/shared.js";

const CRATE_SIZE = 24;

const galleryStatus = document.getElementById("galleryStatus");
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
      ? `${completedCrates} ${completedCrates === 1 ? "caixa já fechada" : "caixas já fechadas"} pela rapaziada.`
      : "Cada lembrança aprovada ocupa um casco na grade.";

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
  audioGrid.replaceChildren();
  mediaGrid.replaceChildren();

  const filtered =
    activeFilter === "all" ? allItems : allItems.filter((item) => item.kind === activeFilter);

  if (filtered.length === 0) {
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
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
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

    setStatus("Enviando arquivo para o estoque da Vercel...");
    const blob = await upload(`media/${preparedFile.name}`, preparedFile, {
      access: "public",
      handleUploadUrl: "/api/upload",
      clientPayload: JSON.stringify({ website: websiteInput.value || "" }),
    });

    setStatus("Avisando o administrador por e-mail para aprovar...");
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
    setStatus("Recebido! O link de revisão já foi enviado por e-mail. Assim que for aprovado, entra na galeria.");
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

initModerationBanner();
loadItems();
