(() => {
  'use strict';
  const seen = new Map();
  const observedVideos = new WeakSet();
  let scheduled = false;
  const isHttp = u => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };
  function offer(url, width = 0, height = 0) {
    if (!url || !isHttp(url)) return;
    const previous = seen.get(url);
    if (previous && previous.width >= width && previous.height >= height) return;
    seen.set(url, {url, width, height});
    chrome.runtime.sendMessage({type: 'MEDIA_FOUND', items: [{url, width, height}]}).catch(() => {});
  }
  function scan() {
    scheduled = false;
    const elements = document.querySelectorAll('video, audio');
    for (const media of elements) {
      const width = media.videoWidth || 0, height = media.videoHeight || 0;
      offer(media.currentSrc || media.src, width, height);
      for (const source of media.querySelectorAll('source[src]')) offer(source.src, width, height);
      if (!observedVideos.has(media)) {
        observedVideos.add(media);
        media.addEventListener('loadedmetadata', () => offer(media.currentSrc || media.src, media.videoWidth || 0, media.videoHeight || 0));
      }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(scan, 500);
  }
  scan();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['src']});
  document.addEventListener('play', schedule, true);
  document.addEventListener('loadedmetadata', schedule, true);
  window.addEventListener('pageshow', schedule);
})();
