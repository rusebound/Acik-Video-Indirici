'use strict';
const results = document.getElementById('results');
const status = document.getElementById('status');
const refresh = document.getElementById('refresh');
const {safeName, qualityLabel, getExt} = VideoCore;
let currentTab = null;
const labels = {direct: 'DOĞRUDAN VİDEO', 'direct-audio': 'DOĞRUDAN SES', hls: 'HLS AKIŞI', dash: 'MPEG-DASH'};
function node(tag, cls, text) {
  const elem = document.createElement(tag);
  if (cls) elem.className = cls;
  if (text !== undefined) elem.textContent = text;
  return elem;
}
function isYouTubePage(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be') return /^\/[A-Za-z0-9_-]{11}$/.test(url.pathname);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) return false;
    return (url.pathname === '/watch' && /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '')) ||
      /^\/(shorts|live)\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
  } catch { return false; }
}
function empty(text) {
  results.replaceChildren(node('p', 'empty', text));
}
async function load() {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const tab = tabs[0];
    if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) {
      status.textContent = 'Bu sayfa desteklenmiyor';
      empty('Eklentiyi normal bir web sayfasında açın.'); return;
    }
    currentTab = tab;
    if (isYouTubePage(tab.url)) {
      const card = node('article', 'media-card');
      card.append(node('div', 'type', 'YOUTUBE · YEREL İNDİRİCİ'));
      card.append(node('p', 'host', 'Video biçimi ve çözünürlük veya MP3, M4A, Opus, FLAC, WAV ses dosyası seçin.'));
      const button = node('button', 'primary', 'YouTube kalite seç / indir');
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const key = crypto.randomUUID();
          await chrome.storage.session.set({[key]: {url: tab.url, created: Date.now()}});
          await chrome.tabs.create({url: chrome.runtime.getURL('youtube.html') + '#' + key});
          window.close();
        } catch (error) { button.disabled = false; card.append(node('p', 'error', error.message)); }
      });
      card.append(button);
      results.replaceChildren(card);
      status.textContent = 'YouTube videosu algılandı';
      return;
    }
    const data = await chrome.runtime.sendMessage({type: 'GET_MEDIA', tabId: tab.id});
    const items = data?.items || [];
    status.textContent = items.length ? `${items.length} medya kaynağı algılandı` : 'Medya kaynağı bulunamadı';
    results.replaceChildren();
    if (!items.length) { empty('Bu sayfada henüz indirilebilir video veya ses dosyası tespit edilmedi.'); return; }
    for (const entry of items) {
      const item = node('article', 'media-card');
      const heading = node('div', 'media-line');
      heading.append(node('span', 'type', labels[entry.type]));
      heading.append(node('span', 'resolution', entry.height ? qualityLabel(entry.width, entry.height) : (getExt(entry.url).toUpperCase() || 'Akış')));
      item.append(heading);
      try { item.append(node('div', 'host', new URL(entry.url).hostname)); } catch {}
      let button;
      if (entry.type === 'direct' || entry.type === 'direct-audio') {
        button = node('button', 'primary', entry.type === 'direct-audio' ? 'Ses dosyasını indir' : 'Videoyu indir');
        button.addEventListener('click', async () => {
          button.disabled = true;
          button.textContent = 'İndirme hazırlanıyor…';
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'DOWNLOAD_DIRECT', tabId: tab.id, url: entry.url, title: safeName(tab.title || 'Video')
            });
            if (!response?.ok) throw new Error(response?.error || 'İndirme başlatılamadı.');
            button.textContent = 'İndirme tarayıcıya aktarıldı';
          } catch (err) { button.textContent = 'Tekrar dene'; button.disabled = false; item.append(node('p', 'error', err.message)); }
        });
      } else if (entry.type === 'hls') {
        button = node('button', 'primary', 'Kalite seç / kaydet');
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const key = crypto.randomUUID();
            await chrome.storage.session.set({[key]: {url: entry.url, title: safeName(tab.title || 'Video'), created: Date.now()}});
            await chrome.tabs.create({url: chrome.runtime.getURL('download.html') + '#' + encodeURIComponent(key)});
            window.close();
          } catch (err) { button.disabled = false; item.append(node('p', 'error', err.message)); }
        });
      } else {
        button = node('button', 'secondary', 'Bu sürümde indirilemiyor');
        button.disabled = true;
      }
      item.append(button);
      results.append(item);
    }
  } catch (e) { status.textContent = 'Hata'; empty(e.message || 'Sayfa taranamadı.'); }
}
refresh.addEventListener('click', load);
load();
