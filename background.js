importScripts('core.js');
'use strict';
const {validUrl, detectType, getExt, safeName} = VideoCore;
const mediaByTab = new Map();
const MAX_ITEMS = 48;
const AGE_MS = 30 * 60 * 1000;

function updateBadge(tabId) {
  const size = mediaByTab.get(tabId)?.size || 0;
  chrome.action.setBadgeText({tabId, text: size ? String(Math.min(size, 99)) : ''}).catch(() => {});
  if (size) chrome.action.setBadgeBackgroundColor({tabId, color: '#ee8154'}).catch(() => {});
}
function addMedia(tabId, entry) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const url = validUrl(entry.url);
  if (!url) return;
  const type = entry.type || detectType(url, entry.contentType || '');
  if (!['direct', 'direct-audio', 'hls', 'dash'].includes(type)) return;
  let items = mediaByTab.get(tabId);
  if (!items) { items = new Map(); mediaByTab.set(tabId, items); }
  const old = items.get(url);
  items.set(url, {
    url, type,
    width: Number(entry.width) > 0 ? Number(entry.width) : old?.width || 0,
    height: Number(entry.height) > 0 ? Number(entry.height) : old?.height || 0,
    contentType: entry.contentType || old?.contentType || '',
    seen: Date.now()
  });
  for (const [key, item] of items) if (Date.now() - item.seen > AGE_MS) items.delete(key);
  while (items.size > MAX_ITEMS) items.delete(items.keys().next().value);
  updateBadge(tabId);
}
function listMedia(tabId) {
  return [...(mediaByTab.get(tabId)?.values() || [])].sort((a, b) =>
    (a.type.startsWith('direct') ? -1 : 0) - (b.type.startsWith('direct') ? -1 : 0) || b.seen - a.seen
  );
}
chrome.webRequest.onBeforeRequest.addListener(details => {
  const type = detectType(details.url);
  if (type) addMedia(details.tabId, {url: details.url, type});
}, {urls: ['http://*/*', 'https://*/*'], types: ['media', 'xmlhttprequest', 'other']});
chrome.webRequest.onHeadersReceived.addListener(details => {
  const mime = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
  const type = detectType(details.url, mime);
  if (type) addMedia(details.tabId, {url: details.url, type, contentType: mime});
}, {urls: ['http://*/*', 'https://*/*'], types: ['media', 'xmlhttprequest', 'other']}, ['responseHeaders']);
chrome.tabs.onRemoved.addListener(tabId => mediaByTab.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url) {
    mediaByTab.delete(tabId);
    updateBadge(tabId);
  }
});
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (request?.type === 'MEDIA_FOUND') {
    if (sender.tab?.id !== undefined && Array.isArray(request.items)) {
      for (const entry of request.items.slice(0, 80)) addMedia(sender.tab.id, entry);
    }
    respond({ok: true});
    return;
  }
  if (request?.type === 'GET_MEDIA') {
    respond({ok: true, items: listMedia(Number(request.tabId))});
    return;
  }
  if (request?.type === 'DOWNLOAD_DIRECT') {
    const tabId = Number(request.tabId);
    const item = mediaByTab.get(tabId)?.get(request.url);
    if (!item || !['direct', 'direct-audio'].includes(item.type)) { respond({ok: false, error: 'Geçerli medya kaydı bulunamadı.'}); return; }
    const extension = getExt(item.url);
    const mime = item.contentType.toLowerCase();
    const isAudio = item.type === 'direct-audio';
    const inferred = isAudio
      ? (mime.includes('flac') ? 'flac' : mime.includes('wav') ? 'wav' : mime.includes('opus') ? 'opus' : mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('aac') ? 'aac' : 'mp3')
      : (mime.includes('matroska') ? 'mkv' : mime.includes('webm') ? 'webm' : mime.includes('quicktime') ? 'mov' : mime.includes('ogg') ? 'ogv' : 'mp4');
    const allowed = isAudio ? ['mp3','m4a','aac','ogg','oga','opus','wav','flac','webm'] : ['mp4','m4v','webm','mov','ogv','mkv','avi','3gp'];
    const ext = allowed.includes(extension) ? extension : inferred;
    const name = safeName(request.title || (isAudio ? 'Ses' : 'Video'));
    chrome.downloads.download({url: item.url, filename: `${name}.${ext}`, saveAs: false, conflictAction: 'uniquify'}, downloadId => {
      const error = chrome.runtime.lastError?.message;
      respond(error ? {ok: false, error} : {ok: true, downloadId});
    });
    return true;
  }
});
