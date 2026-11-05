'use strict';
const {parseMaster, parseMedia, qualityLabel, safeName, validUrl} = VideoCore;
const field = document.getElementById('quality');
const startButton = document.getElementById('start');
const cancelButton = document.getElementById('cancel');
const progress = document.getElementById('progress');
const message = document.getElementById('message');
const details = document.getElementById('details');
let variants = [], sourceName = 'Video', controller = null, working = false;
const state = new Map();
function say(text, error = false) { message.textContent = text; message.className = error ? 'error' : ''; }
function fmtBytes(bytes) {return (bytes/1048576).toFixed(1) + ' MB';}
async function fetchText(url, signal) {
  const response = await fetch(url, {credentials: 'omit', cache: 'no-store', signal});
  if (!response.ok) throw new Error(`Liste alınamadı: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > 5 * 1024 * 1024) throw new Error('Oynatma listesi çok büyük.');
  const body = await response.text();
  if (body.length > 5 * 1024 * 1024) throw new Error('Oynatma listesi çok büyük.');
  return body;
}
async function getMedia(variant, signal) {
  if (state.has(variant.url)) return state.get(variant.url);
  const data = await fetchText(variant.url, signal);
  const segments = parseMedia(data, variant.url);
  state.set(variant.url, segments);
  return segments;
}
async function selectVariant() {
  if (!variants.length) return;
  const item = variants[Number(field.value)];
  if (!item) return;
  startButton.disabled = true;
  try {
    if (item.separateAudio) throw new Error('Bu kalite ayrı ses kanalı kullanıyor. Bu sürümde sesli ve eksiksiz dosya oluşturulamıyor.');
    const media = await getMedia(item);
    details.textContent = `${media.segments.length} video parçası · .${media.extension} dosyası · ${qualityLabel(item.width, item.height)}`;
    say('Hazır. Kaydetmek için dosya konumu seçin.');
    startButton.disabled = false;
  } catch (error) {details.textContent = ''; say(error.message, true);}
}
async function init() {
  try {
    const key = decodeURIComponent(location.hash.slice(1));
    if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error('Video isteği geçersiz.');
    const data = await chrome.storage.session.get(key);
    await chrome.storage.session.remove(key);
    const request = data[key];
    if (!request || Date.now() - request.created > 10 * 60 * 1000 || !validUrl(request.url))
      throw new Error('Video oturumu sona ermiş. Eklentiden yeniden açın.');
    history.replaceState(null, '', location.pathname);
    sourceName = safeName(request.title);
    const txt = await fetchText(request.url);
    const parsed = parseMaster(txt, request.url);
    variants = parsed.length ? parsed : [{url: request.url, width: 0, height: 0, bandwidth: 0, separateAudio: false}];
    field.replaceChildren();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = v.height ? qualityLabel(v.width, v.height) : `Akış ${i+1}${v.bandwidth ? ' · ' + (v.bandwidth/1e6).toFixed(1) + ' Mb/sn' : ''}`;
      field.append(opt);
    }
    field.disabled = false;
    await selectVariant();
  } catch (error) { say(error.message, true); details.textContent = ''; }
}
async function writeStream(file, part, signal, cb) {
  const headers = {};
  if (part.range) headers.Range = `bytes=${part.range.start}-${part.range.end}`;
  const r = await fetch(part.url, {credentials: 'omit', signal, headers, cache: 'no-store'});
  if (!r.ok) throw new Error(`Parça alınamadı: HTTP ${r.status}`);
  if (part.range && r.status !== 206) throw new Error('Kaynak sunucu istenen byte aralığını desteklemiyor.');
  const mime = r.headers.get('content-type') || '';
  if (/text\/html/i.test(mime)) throw new Error('Video yerine HTML sayfası gönderildi.');
  if (!r.body) throw new Error('Tarayıcı akışlı indirmeyi desteklemiyor.');
  let total = 0;
  const reader = r.body.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.length;
    await file.write(value);
    cb(value.length);
  }
  if (part.range && total !== part.range.end - part.range.start + 1)
    throw new Error('Video parçası boyutu beklenenden farklı.');
  if (!total) throw new Error('Boş video parçası alındı.');
}
async function save() {
  if (working) return;
  const item = variants[Number(field.value)];
  const media = state.get(item?.url);
  if (!item || !media || item.separateAudio) return;
  if (!window.showSaveFilePicker) {say('Bu tarayıcı dosya seçme API’sini desteklemiyor.', true); return;}
  let handle;
  try {
    handle = await window.showSaveFilePicker({
      startIn: 'downloads',
      suggestedName: `${sourceName}${item.height ? '-' + item.height + 'p' : ''}.${media.extension}`,
      types: [{description: 'Video dosyası', accept: {[media.extension === 'mp4' ? 'video/mp4' : 'video/mp2t']: ['.' + media.extension]}}]
    });
  } catch (error) { if (error.name !== 'AbortError') say(error.message, true); return; }
  working = true;
  startButton.disabled = true; field.disabled = true; cancelButton.disabled = false;
  controller = new AbortController();
  let stream;
  let bytes = 0;
  try {
    stream = await handle.createWritable();
    const parts = [...(media.map ? [media.map] : []), ...media.segments];
    for (let i = 0; i < parts.length; i++) {
      if (controller.signal.aborted) throw new DOMException('İşlem iptal edildi.', 'AbortError');
      say(`Kaydediliyor: ${Math.min(i + 1, parts.length)}/${parts.length} parça · ${fmtBytes(bytes)}`);
      await writeStream(stream, parts[i], controller.signal, n => { bytes += n; });
      progress.style.width = `${((i + 1) / parts.length * 100).toFixed(2)}%`;
    }
    await stream.close();
    stream = null;
    say(`Dosya başarıyla kaydedildi · ${fmtBytes(bytes)}`);
  } catch (error) {
    if (stream) { try { await stream.abort(); } catch {} }
    say(error.name === 'AbortError' ? 'İndirme iptal edildi.' : `Kaydetme başarısız: ${error.message}`, true);
  } finally {
    working = false; controller = null;
    startButton.disabled = false; field.disabled = false; cancelButton.disabled = true;
  }
}
startButton.addEventListener('click', save);
field.addEventListener('change', selectVariant);
cancelButton.addEventListener('click', () => controller?.abort());
init();
