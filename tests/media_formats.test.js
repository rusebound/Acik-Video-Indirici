const test = require('node:test');
const assert = require('node:assert/strict');
const {detectType} = require('../core.js');

test('direct audio extensions are recognized', () => {
 for (const ext of ['mp3','m4a','aac','ogg','oga','opus','wav','flac']) {
  assert.equal(detectType('https://example.org/track.'+ext),'direct-audio');
 }
});
test('direct video extensions are recognized', () => {
 for (const ext of ['mp4','m4v','webm','mov','ogv','mkv','avi','3gp']) {
  assert.equal(detectType('https://example.org/video.'+ext),'direct');
 }
});
test('mime type distinguishes audio WebM from video WebM', () => {
 assert.equal(detectType('https://cdn.example.org/media.webm','audio/webm'),'direct-audio');
 assert.equal(detectType('https://cdn.example.org/media.webm','video/webm'),'direct');
});
test('audio MIME without extension and codecs are recognized', () => {
 assert.equal(detectType('https://example.org/stream?source=1','audio/flac'),'direct-audio');
 assert.equal(detectType('https://example.org/audio','audio/mpeg'),'direct-audio');
});
test('HLS and DASH retain their existing classification', () => {
 assert.equal(detectType('https://example.org/index.m3u8'),'hls');
 assert.equal(detectType('https://example.org/video.mpd'),'dash');
});
test('unrelated and unsafe URL types not classified as media', () => {
 assert.equal(detectType('https://example.org/style.css'),null);
 assert.equal(detectType('https://example.org/attachment.exe'),null);
});
