"use strict";
const title = document.getElementById("title");
const quality = document.getElementById("quality");
const details = document.getElementById("details");
const rights = document.getElementById("rights");
const start = document.getElementById("start");
const cancel = document.getElementById("cancel");
const progress = document.getElementById("progress");
const message = document.getElementById("message");
const downloadMode = document.getElementById("downloadMode");
const audioFormat = document.getElementById("audioFormat");
const videoFormat = document.getElementById("videoFormat");
const formatHint = document.getElementById("formatHint");
const videoOptions = document.getElementById("videoOptions");
const audioOptions = document.getElementById("audioOptions");
let port = null, sourceUrl = null, busy = false, ready = false;
let hasAudio = false;
let videoVariants = {mkv: [], mp4: [], webm: []};
function say(value, error = false) {
  message.textContent = value;
  message.className = error ? "error" : "";
}
function canDownload() {
  if (!ready || !rights.checked || busy) return false;
  if (downloadMode.value === "audio") return hasAudio && ["mp3", "original", "m4a", "opus", "flac", "wav"].includes(audioFormat.value);
  const h = Number(quality.value);
  return Number.isInteger(h) && (videoVariants[videoFormat.value] || []).includes(h);
}
function updateStart() { start.disabled = !canDownload(); }
function updateQuality() {
  const previous = Number(quality.value);
  const available = videoVariants[videoFormat.value] || [];
  quality.replaceChildren();
  for (const h of available) {
    const option = document.createElement("option");
    option.value = String(h);
    option.textContent = h === 2160 ? "2160p · 4K UHD" : h === 1440 ? "1440p · QHD" : h + "p";
    quality.append(option);
  }
  quality.disabled = !available.length || busy;
  if (available.includes(previous)) quality.value = String(previous);
  formatHint.textContent = available.length
    ? videoFormat.value.toUpperCase() + " için " + available.length + " kaynak çözünürlüğü mevcut. Çözünürlük yükseltilmez."
    : "Bu videoda seçilen kapsayıcı için uyumlu video ve ses akışı bulunmuyor. Başka biçim seçin.";
  updateStart();
}
function updateMode() {
  const isAudio = downloadMode.value === "audio";
  videoOptions.hidden = isAudio;
  audioOptions.hidden = !isAudio;
  start.textContent = isAudio ? "Sesi indir" : "Videoyu indir";
  updateStart();
}
rights.addEventListener("change", updateStart);
downloadMode.addEventListener("change", updateMode);
audioFormat.addEventListener("change", updateStart);
videoFormat.addEventListener("change", updateQuality);
quality.addEventListener("change", updateStart);
function handle(data) {
  if (!data || typeof data !== "object") return;
  if (data.type === "info") {
    title.textContent = data.title || "Video";
    const formats = data.video_formats || {};
    videoVariants = {
      mkv: Array.isArray(formats.mkv) ? formats.mkv : [],
      mp4: Array.isArray(formats.mp4) ? formats.mp4 : [],
      webm: Array.isArray(formats.webm) ? formats.webm : []
    };
    hasAudio = data.audio_available === true;
    ready = Object.values(videoVariants).some(v => v.length > 0) || hasAudio;
    downloadMode.disabled = !ready;
    if (!ready) say("İndirilebilir video veya ses akışı bulunamadı.", true);
    else say("İndirme türünü, dosya biçimini ve kaliteyi seçip indirme hakkınızı onaylayın.");
    details.textContent = (videoVariants.mkv.length ? videoVariants.mkv.length + " video çözünürlüğü" : "Görüntü yok") +
      (hasAudio ? " · Ses mevcut" : " · Ses yok") +
      (data.duration ? " · " + Math.round(data.duration / 60) + " dakika" : "");
    updateQuality();
    updateMode();
  } else if (data.type === "progress") {
    if (data.percent != null) progress.style.width = Math.max(0, Math.min(100, data.percent)).toFixed(1) + "%";
    say(data.text || "İndiriliyor…");
  } else if (data.type === "started") {
    busy = true; cancel.disabled = false; updateStart(); say("İndirme başlatıldı…");
  } else if (data.type === "complete") {
    busy = false; cancel.disabled = true; progress.style.width = "100%";
    updateStart(); say("İndirme tamamlandı. Klasör: " + (data.filename || "İndirilenler"));
  } else if (data.type === "cancelled") {
    busy = false; cancel.disabled = true; updateStart(); say("İşlem iptal edildi.");
  } else if (data.type === "error") {
    busy = false; cancel.disabled = true; updateStart();
    say(data.message || "İşlem başarısız.", true);
  }
}
async function init() {
  try {
    const key = decodeURIComponent(location.hash.slice(1));
    if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("İndirme isteği geçersiz.");
    const result = await chrome.storage.session.get(key);
    await chrome.storage.session.remove(key);
    const request = result[key];
    if (!request || Date.now() - request.created > 600000) throw new Error("Oturum süresi doldu. Eklentiden yeniden açın.");
    const parsed = new URL(request.url);
    if (parsed.protocol !== "https:") throw new Error("Yalnızca HTTPS bağlantıları desteklenir.");
    sourceUrl = request.url;
    history.replaceState(null, "", location.pathname);
    port = chrome.runtime.connectNative("com.acikvideo.indirici");
    port.onMessage.addListener(handle);
    port.onDisconnect.addListener(() => {
      ready = false; busy = false; cancel.disabled = true; updateStart();
      say("Yerel indirme bileşeni bağlantısı kesildi: " +
        (chrome.runtime.lastError?.message || "Kurulum ve kayıt bilgilerini kontrol edin."), true);
    });
    port.postMessage({type: "info", url: sourceUrl});
  } catch (error) { say(error.message, true); }
}
start.addEventListener("click", () => {
  if (!port || !canDownload()) return;
  const mode = downloadMode.value;
  const payload = {type: "download", url: sourceUrl, confirmed: true, mode};
  if (mode === "audio") payload.audio_format = audioFormat.value;
  else {payload.height = Number(quality.value); payload.video_format = videoFormat.value;}
  busy = true; updateStart(); progress.style.width = "0%";
  port.postMessage(payload);
});
cancel.addEventListener("click", () => {
  if (busy && port) { port.postMessage({type: "cancel"}); cancel.disabled = true; }
});
downloadMode.disabled = true;
updateMode();
init();
