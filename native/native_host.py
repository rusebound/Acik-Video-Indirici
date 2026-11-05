"""Windows Chrome/Edge Native Messaging host for authorized YouTube downloads.

Only accepts a single public YouTube video URL, a bounded resolution and an
explicit rights confirmation. Does not use cookies, bypass DRM, or permit file paths.
"""
import json
import os
from pathlib import Path
import re
import struct
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit

HOST_NAME = 'com.acikvideo.indirici'
VID_RE = re.compile(r'^[A-Za-z0-9_-]{11}$')
WRITE_LOCK = threading.Lock()
WORK_LOCK = threading.Lock()
WORKER = None
CANCEL_EVENT = threading.Event()


def normalize_youtube(url):
    if not isinstance(url, str) or len(url) > 2048:
        raise ValueError('YouTube bağlantısı geçersiz.')
    u = urlsplit(url)
    if u.scheme != 'https' or u.username or u.password or u.port:
        raise ValueError('Yalnızca HTTPS YouTube bağlantısı kabul edilir.')
    host = (u.hostname or '').lower()
    path = u.path
    if host == 'youtu.be':
        vid = path.strip('/') if path.count('/') <= 1 else ''
    elif host in ('youtube.com', 'www.youtube.com', 'm.youtube.com'):
        if path == '/watch':
            values = parse_qs(u.query).get('v', [])
            vid = values[0] if len(values) == 1 else ''
        else:
            match = re.fullmatch(r'/(?:shorts|live)/([A-Za-z0-9_-]{11})/?', path)
            vid = match.group(1) if match else ''
    else:
        raise ValueError('Yalnızca YouTube videoları desteklenir.')
    if not VID_RE.fullmatch(vid):
        raise ValueError('Video kimliği geçersiz.')
    return 'https://www.youtube.com/watch?v=' + vid


def pack(message):
    data = json.dumps(message, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    if len(data) > 1024 * 1024:
        raise ValueError('Yanıt sınırı aşıldı.')
    return struct.pack('=I', len(data)) + data


def send(message):
    with WRITE_LOCK:
        sys.stdout.buffer.write(pack(message))
        sys.stdout.buffer.flush()


def read_messages():
    while True:
        head = sys.stdin.buffer.read(4)
        if not head:
            return
        if len(head) != 4:
            return
        length = struct.unpack('=I', head)[0]
        if length < 1 or length > 1024 * 1024:
            return
        buf = sys.stdin.buffer.read(length)
        if len(buf) != length:
            return
        try:
            message = json.loads(buf)
            if isinstance(message, dict):
                yield message
        except (ValueError, UnicodeDecodeError):
            send({'type': 'error', 'message': 'İleti okunamadı.'})


class QuietLogger:
    def debug(self, msg):
        pass
    def warning(self, msg):
        print('[yt-dlp warning] ' + str(msg), file=sys.stderr)
    def error(self, msg):
        print('[yt-dlp error] ' + str(msg), file=sys.stderr)


def options():
    # No browser cookies or authentication. Streams stay at the original quality.
    data = {'noplaylist': True, 'quiet': True, 'no_warnings': True,
            'logger': QuietLogger(), 'socket_timeout': 25,
            'retries': 3, 'fragment_retries': 3,
            'js_runtimes': {'node': {'path': r'C:\Program Files\nodejs\node.exe'}} if os.name == 'nt' else {'node': {}}}
    try:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        if Path(ffmpeg).is_file():
            data['ffmpeg_location'] = ffmpeg
    except (ImportError, RuntimeError, OSError):
        pass
    return data


VIDEO_CONTAINERS = frozenset(('mkv', 'mp4', 'webm'))
AUDIO_CONTAINERS = frozenset(('original', 'mp3', 'm4a', 'opus', 'wav', 'flac'))


def stream_available(fmt, kind):
    if fmt.get('has_drm') in (True, 'yes'):
        return False
    codec = fmt.get('vcodec' if kind == 'video' else 'acodec')
    return isinstance(codec, str) and codec != 'none'


def video_container_options(formats):
    """Only offer copy-compatible MP4 and WebM variants; never relabel codecs."""
    formats = [f for f in formats if isinstance(f, dict)]
    video = [f for f in formats if stream_available(f, 'video')
             and isinstance(f.get('height'), (int, float))
             and 144 <= int(f['height']) <= 4320]
    audio = [f for f in formats if stream_available(f, 'audio')]
    has_m4a = any(f.get('ext') == 'm4a' and
                  str(f.get('acodec', '')).startswith('mp4a') for f in audio)
    has_webm = any(f.get('ext') == 'webm' and
                   str(f.get('acodec', '')).startswith(('opus', 'vorbis')) for f in audio)
    out = {}
    for name in ('mkv', 'mp4', 'webm'):
        eligible = []
        for f in video:
            vcodec = str(f.get('vcodec', ''))
            ext = f.get('ext')
            if name == 'mkv' and audio:
                eligible.append(int(f['height']))
            elif name == 'mp4' and has_m4a and ext == 'mp4' and vcodec.startswith(('avc1', 'h264')):
                eligible.append(int(f['height']))
            elif name == 'webm' and has_webm and ext == 'webm' and vcodec.startswith(('vp8', 'vp9', 'av01')):
                eligible.append(int(f['height']))
        out[name] = sorted(set(eligible), reverse=True)
    return out


def download_settings(height=None, audio_format=None, video_format='mkv'):
    """Trusted format options only; unsupported conversions are never silently forced."""
    if audio_format is not None:
        if audio_format not in AUDIO_CONTAINERS:
            raise ValueError('Ses biçimi desteklenmiyor.')
        settings = {'format': 'ba[acodec!=none]/bestaudio'}
        if audio_format != 'original':
            pp = {'key': 'FFmpegExtractAudio', 'preferredcodec': audio_format}
            if audio_format == 'mp3':
                pp['preferredquality'] = '256'
            settings['postprocessors'] = [pp]
        return settings
    if video_format not in VIDEO_CONTAINERS:
        raise ValueError('Video kapsayıcısı desteklenmiyor.')
    if type(height) is not int or not 144 <= height <= 4320:
        raise ValueError('Çözünürlük geçersiz.')
    if video_format == 'mp4':
        selector = (f'bv[height={height}][ext=mp4][vcodec^=avc1]+'
                    f'ba[ext=m4a][acodec^=mp4a]')
    elif video_format == 'webm':
        selector = f'bv[height={height}][ext=webm]+ba[ext=webm]'
    else:
        selector = f'bv[height={height}]+ba/b[height={height}]'
    settings = {'format': selector, 'merge_output_format': video_format}
    if video_format == 'mkv':
        settings['postprocessors'] = [
            {'key': 'FFmpegVideoRemuxer', 'preferedformat': 'mkv'}
        ]
    return settings


def worker_info(url):
    try:
        from yt_dlp import YoutubeDL
        with YoutubeDL(options()) as ydl:
            info = ydl.extract_info(url, download=False)
        if info.get('is_live'):
            raise ValueError('Canlı yayın indirme bu sürümde desteklenmiyor.')
        heights = sorted({int(f['height']) for f in info.get('formats', [])
                          if isinstance(f.get('height'), (int, float))
                          and f.get('vcodec') not in (None, 'none')
                          and f.get('has_drm') not in (True, 'yes')
                          and 144 <= int(f['height']) <= 4320}, reverse=True)
        audio_available = any(f.get('acodec') not in (None, 'none')
                              and f.get('has_drm') not in (True, 'yes')
                              for f in info.get('formats', []))
        containers = video_container_options(info.get('formats', []))
        send({'type': 'info', 'title': str(info.get('title') or 'Video')[:180],
              'duration': info.get('duration') or 0, 'heights': heights,
              'video_formats': containers,
              'audio_available': audio_available})
    except Exception as exc:
        send({'type': 'error', 'message': ('Video bilgisi alınamadı: ' + str(exc))[:400]})


def worker_download(url, height=None, audio_format=None, video_format='mkv'):
    settings = download_settings(height, audio_format, video_format)
    import yt_dlp
    from yt_dlp import YoutubeDL
    last_report = [0.0]
    # Save media directly to the user's Downloads directory, without subfolders.
    dest = Path.home() / 'Downloads'
    dest.mkdir(parents=True, exist_ok=True)

    def progress(data):
        if CANCEL_EVENT.is_set():
            raise ValueError('İndirme iptal edildi.')
        now = time.monotonic()
        if data.get('status') == 'downloading' and now - last_report[0] >= 0.65:
            last_report[0] = now
            total = data.get('total_bytes') or data.get('total_bytes_estimate') or 0
            done = data.get('downloaded_bytes') or 0
            percent = (100 * done / total) if total else None
            send({'type': 'progress', 'percent': percent,
                  'text': f'İndiriliyor · {done / 1048576:.1f} MB' + (f' / {total / 1048576:.1f} MB' if total else '')})

    try:
        is_audio = audio_format is not None
        ydl_opts = options()
        ydl_opts.update({
            'outtmpl': str(dest / '%(title).120B [%(id)s].%(ext)s'),
            'overwrites': False,
            'progress_hooks': [progress],
            'noprogress': True,
            'continuedl': True,
        })
        ydl_opts.update(settings)
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info.get('is_live'):
                raise ValueError('Canlı yayın desteklenmiyor.')
            if CANCEL_EVENT.is_set():
                raise ValueError('İndirme iptal edildi.')
            if not is_audio:
                available = video_container_options(info.get('formats', []))
                if height not in available[video_format]:
                    raise ValueError('Bu kalite ve dosya biçimi kaynakta birlikte bulunmuyor.')
            result = ydl.extract_info(url, download=True)
            # Best effort: paths can differ by format/merge; report destination folder, not an invented file name.
        if CANCEL_EVENT.is_set():
            send({'type': 'cancelled'})
        else:
            send({'type': 'complete', 'filename': str(dest)})
    except Exception as exc:
        if CANCEL_EVENT.is_set():
            send({'type': 'cancelled'})
        else:
            send({'type': 'error', 'message': ('İndirme başarısız: ' + str(exc))[:400]})
    finally:
        CANCEL_EVENT.clear()


def start_worker(fn, *args):
    global WORKER
    with WORK_LOCK:
        if WORKER is not None and WORKER.is_alive():
            send({'type': 'error', 'message': 'Önceki işlem sürüyor.'})
            return
        CANCEL_EVENT.clear()
        WORKER = threading.Thread(target=fn, args=args, daemon=False)
        WORKER.start()


def handle(message):
    kind = message.get('type')
    if kind == 'cancel':
        CANCEL_EVENT.set()
        return
    if kind not in ('info', 'download'):
        send({'type': 'error', 'message': 'Bilinmeyen işlem.'})
        return
    try:
        url = normalize_youtube(message.get('url'))
        if kind == 'info':
            start_worker(worker_info, url)
        else:
            if message.get('confirmed') is not True:
                raise ValueError('İndirme hakkı onaylanmadı.')
            mode = message.get('mode', 'video')
            if mode == 'audio':
                audio_format = message.get('audio_format')
                if audio_format not in AUDIO_CONTAINERS:
                    raise ValueError('Ses dosyası biçimi geçersiz.')
                start_worker(worker_download, url, None, audio_format)
            elif mode == 'video':
                height = message.get('height')
                video_format = message.get('video_format', 'mkv')
                download_settings(height, None, video_format)
                if video_format == 'mkv':
                    start_worker(worker_download, url, height)
                else:
                    start_worker(worker_download, url, height, None, video_format)
            else:
                raise ValueError('İndirme türü geçersiz.')
            send({'type': 'started'})
    except Exception as exc:
        send({'type': 'error', 'message': str(exc)[:300]})


def main():
    if os.name == 'nt':
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    for message in read_messages():
        handle(message)
    # When the tab closes, Chrome closes stdin. A running job must stop; cancellation is cooperative.
    CANCEL_EVENT.set()
    if WORKER is not None and WORKER.is_alive():
        WORKER.join(timeout=5)

if __name__ == '__main__':
    main()
