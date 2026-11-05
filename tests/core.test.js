const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('../core.js');
test('HTTP(S) dışındaki adresler filtrelenir', () => {
  assert.equal(core.validUrl('javascript:alert(1)'), null);
  assert.equal(core.validUrl('file:///x.mp4'), null);
  assert.equal(core.validUrl('blob:https://site.test/a'), null);
  assert.equal(core.validUrl('../video.mp4', 'https://site.test/a/b'), 'https://site.test/video.mp4');
});
test('Video ve HLS/DASH türleri tanınır', () => {
  assert.equal(core.detectType('https://a.test/video.mp4?token=1'), 'direct');
  assert.equal(core.detectType('https://a.test/master.m3u8'), 'hls');
  assert.equal(core.detectType('https://a.test/playlist', 'application/vnd.apple.mpegurl'), 'hls');
  assert.equal(core.detectType('https://a.test/manifest.mpd'), 'dash');
  assert.equal(core.detectType('https://a.test/subtitle.vtt'), null);
});
test('Dosya adı güvenli hale getirilir', () => {
  assert.equal(core.safeName('Deneme: Film / 4K?'), 'Deneme Film 4K');
  assert.equal(core.safeName('..'), 'Video');
});
test('Master çalma listesi çözünürlüğe göre sıralanır', () => {
  const txt = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=1280x720\n720.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=3840x2160\n4k.m3u8\n';
  const variants = core.parseMaster(txt, 'https://x.test/master.m3u8');
  assert.equal(variants.length, 2);
  assert.equal(variants[0].height, 2160);
  assert.equal(variants[1].url, 'https://x.test/720.m3u8');
});
test('Tamamlanmış TS listesi ve göreli segmentler', () => {
  const media = core.parseMedia('#EXTM3U\n#EXTINF:8,\nseg1.ts\n#EXTINF:8,\nseg2.ts\n#EXT-X-ENDLIST', 'https://site.test/hls/list.m3u8');
  assert.equal(media.extension, 'ts');
  assert.equal(media.segments.length, 2);
  assert.equal(media.segments[0].url, 'https://site.test/hls/seg1.ts');
});
test('fMP4 başlatma parçası ve byte aralıkları', () => {
  const media = core.parseMedia('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-BYTERANGE:100@0\nall.mp4\n#EXT-X-BYTERANGE:50\nall.mp4\n#EXT-X-ENDLIST', 'https://x.test/a.m3u8');
  assert.equal(media.extension, 'mp4');
  assert.deepEqual(media.segments.map(x => x.range), [{start: 0,end: 99},{start: 100,end: 149}]);
});
test('Şifreli, canlı ve kesintili listeler reddedilir', () => {
  assert.throws(() => core.parseMedia('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="x"\na.ts\n#EXT-X-ENDLIST', 'https://x.test/'), /şifreli/);
  assert.throws(() => core.parseMedia('#EXTM3U\na.ts', 'https://x.test/'), /Canlı/);
  assert.throws(() => core.parseMedia('#EXTM3U\na.ts\n#EXT-X-DISCONTINUITY\nb.ts\n#EXT-X-ENDLIST', 'https://x.test/'), /Kesintili/);
  assert.throws(() => core.parseMaster('#EXTM3U\n#EXT-X-SESSION-KEY:METHOD=AES-128,URI="key"\n#EXT-X-STREAM-INF:BANDWIDTH=1000\na.m3u8', 'https://x.test/'), /koruması/);
});
