/* Aynı kod tarayıcıda, service worker'da ve Node testlerinde çalışır. */
(function (root) {
  'use strict';
  const MAX_PLAYLIST_SIZE = 5 * 1024 * 1024;
  const VIDEO_EXTS = new Set(['mp4', 'm4v', 'webm', 'mov', 'ogv', 'mkv', 'avi', '3gp']);
  const AUDIO_EXTS = new Set(['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac']);

  function validUrl(input, base) {
    try {
      const u = new URL(input, base);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
    } catch { return null; }
  }
  function getExt(url) {
    try {
      const path = new URL(url).pathname;
      return (path.match(/\.([a-z0-9]{2,8})$/i) || [])[1]?.toLowerCase() || '';
    } catch { return ''; }
  }
  function detectType(url, contentType = '') {
    const ct = contentType.split(';')[0].trim().toLowerCase();
    const ext = getExt(url);
    if (ext === 'm3u8' || /(?:mpegurl|x-mpegurl)/.test(ct)) return 'hls';
    if (ext === 'mpd' || ct === 'application/dash+xml') return 'dash';
    if (/^audio\/(?:mpeg|mp3|mp4|aac|ogg|opus|wav|wave|x-wav|flac|x-flac|webm)$/.test(ct)) return 'direct-audio';
    if (VIDEO_EXTS.has(ext) || /^video\/(?:mp4|webm|quicktime|ogg|x-m4v|x-matroska|x-msvideo|3gpp)$/.test(ct)) return 'direct';
    if (AUDIO_EXTS.has(ext)) return 'direct-audio';
    return null;
  }
  function safeName(input, max = 90) {
    const name = String(input || 'Video').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ').replace(/\.+$/g, '').trim().slice(0, max).trim();
    return name || 'Video';
  }
  function qualityLabel(width, height) {
    if (!height) return 'Çözünürlük belirtilmemiş';
    const tag = height >= 2160 ? '4K UHD' : height >= 1440 ? 'QHD' : height >= 1080 ? 'Full HD' : height >= 720 ? 'HD' : 'SD';
    return `${height}p · ${tag}${width ? ` (${width}×${height})` : ''}`;
  }
  function parseAttrs(str) {
    const result = {};
    let p = 0;
    while (p < str.length) {
      while (str[p] === ',' || /\s/.test(str[p] || '') && p < str.length) p++;
      const start = p;
      while (/[A-Za-z0-9-]/.test(str[p] || '')) p++;
      if (start === p) { p++; continue; }
      const key = str.slice(start, p).toUpperCase();
      if (str[p] !== '=') { while (p < str.length && str[p] !== ',') p++; continue; }
      p++;
      if (str[p] === '"') {
        p++;
        const valueStart = p;
        while (p < str.length && str[p] !== '"') p++;
        result[key] = str.slice(valueStart, p);
        if (str[p] === '"') p++;
      } else {
        const valueStart = p;
        while (p < str.length && str[p] !== ',') p++;
        result[key] = str.slice(valueStart, p).trim();
      }
    }
    return result;
  }
  function ensureHls(text) {
    if (typeof text !== 'string' || text.length > MAX_PLAYLIST_SIZE || !text.trimStart().startsWith('#EXTM3U'))
      throw new Error('Geçerli bir HLS oynatma listesi bulunamadı.');
    return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  }
  function parseMaster(text, baseUrl) {
    const lines = ensureHls(text);
    if (lines.some(x => x.startsWith('#EXT-X-SESSION-KEY:')))
      throw new Error('Bu akış anahtar koruması içeriyor ve desteklenmiyor.');
    const hasExternalAudio = lines.some(x => x.startsWith('#EXT-X-MEDIA:') && /TYPE=AUDIO(?:,|$)/i.test(x));
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
      const attrs = parseAttrs(line.slice('#EXT-X-STREAM-INF:'.length));
      const next = lines.slice(i + 1).find(x => !x.startsWith('#'));
      if (!next) continue;
      const url = validUrl(next, baseUrl);
      if (!url) continue;
      const dims = (attrs.RESOLUTION || '').match(/^(\d+)x(\d+)$/i);
      const bandwidth = Number(attrs['AVERAGE-BANDWIDTH'] || attrs.BANDWIDTH || 0);
      variants.push({
        url,
        width: dims ? Number(dims[1]) : 0,
        height: dims ? Number(dims[2]) : 0,
        bandwidth: Number.isFinite(bandwidth) ? bandwidth : 0,
        separateAudio: Boolean(attrs.AUDIO && hasExternalAudio),
        codecs: attrs.CODECS || ''
      });
    }
    return variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));
  }
  function parseByteRange(value, prevEnd) {
    const match = String(value || '').match(/^(\d+)(?:@(\d+))?$/);
    if (!match) throw new Error('Desteklenmeyen byte aralığı.');
    const length = Number(match[1]);
    const start = match[2] ? Number(match[2]) : prevEnd;
    if (!Number.isSafeInteger(length) || length < 1 || !Number.isSafeInteger(start) || start < 0)
      throw new Error('Geçersiz byte aralığı.');
    return {start, end: start + length - 1};
  }
  function parseMedia(text, baseUrl) {
    const lines = ensureHls(text);
    const segments = [];
    const lastEndByUrl = new Map();
    let nextRange = null;
    let map = null;
    let hasEnd = false;
    let encrypted = false;
    let invalid = null;
    for (const line of lines) {
      if (line.startsWith('#EXT-X-KEY:')) {
        const attrs = parseAttrs(line.slice('#EXT-X-KEY:'.length));
        if ((attrs.METHOD || 'NONE').toUpperCase() !== 'NONE') encrypted = true;
      } else if (line.startsWith('#EXT-X-MAP:')) {
        const attrs = parseAttrs(line.slice('#EXT-X-MAP:'.length));
        const uri = validUrl(attrs.URI, baseUrl);
        if (!uri) { invalid = 'Başlatma parçası adresi geçersiz.'; continue; }
        const range = attrs.BYTERANGE ? parseByteRange(attrs.BYTERANGE, 0) : null;
        map = {url: uri, range};
      } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
        nextRange = line.slice('#EXT-X-BYTERANGE:'.length);
      } else if (line === '#EXT-X-ENDLIST') {
        hasEnd = true;
      } else if (line.startsWith('#EXT-X-DISCONTINUITY') || line.startsWith('#EXT-X-GAP') || line.startsWith('#EXT-X-I-FRAMES-ONLY')) {
        invalid = 'Kesintili veya eksik HLS oynatma listeleri bu sürümde desteklenmiyor.';
      } else if (!line.startsWith('#')) {
        const url = validUrl(line, baseUrl);
        if (!url) { invalid = 'Video parçası adresi geçersiz.'; continue; }
        const range = nextRange ? parseByteRange(nextRange, (lastEndByUrl.get(url) ?? -1) + 1) : null;
        if (range) lastEndByUrl.set(url, range.end);
        segments.push({url, range});
        nextRange = null;
      }
    }
    if (encrypted) throw new Error('DRM/şifreli HLS akışı desteklenmiyor.');
    if (invalid) throw new Error(invalid);
    if (!hasEnd) throw new Error('Canlı akış veya tamamlanmamış oynatma listesi desteklenmiyor.');
    if (!segments.length) throw new Error('İndirilebilir video parçası bulunamadı.');
    const isFmp4 = Boolean(map) || segments.some(x => /\.(?:m4s|mp4)$/i.test(new URL(x.url).pathname));
    if (isFmp4 && !map) throw new Error('fMP4 parçalarında başlatma bilgisi (#EXT-X-MAP) eksik.');
    if (!isFmp4 && segments.some(x => /\.(?:aac|mp3)$/i.test(new URL(x.url).pathname)))
      throw new Error('Bu oynatma listesi yalnızca ses içeriği taşıyor.');
    return {segments, map, extension: isFmp4 ? 'mp4' : 'ts'};
  }
  root.VideoCore = {validUrl, getExt, detectType, safeName, qualityLabel, parseAttrs, parseMaster, parseMedia};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VideoCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
