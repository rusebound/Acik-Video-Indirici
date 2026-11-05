import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch, MagicMock
import unittest

spec=importlib.util.spec_from_file_location("host_download_location",
    Path(__file__).resolve().parents[1]/"native"/"native_host.py")
host=importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
URL="https://www.youtube.com/watch?v=aqz-KE-bpKQ"
SAMPLE=[
 {"ext":"mp4","height":144,"vcodec":"avc1.4d400c","acodec":"none"},
 {"ext":"m4a","vcodec":"none","acodec":"mp4a.40.2"}
]

class DownloadLocationTests(unittest.TestCase):
    def exercise(self, mode):
        with TemporaryDirectory() as folder:
            root=Path(folder)
            fake=MagicMock()
            fake.__enter__.return_value.extract_info.side_effect=[
                {"is_live":False,"formats":SAMPLE},
                {"is_live":False,"formats":SAMPLE},
            ]
            with patch.object(host.Path, "home", return_value=root), \
                 patch("yt_dlp.YoutubeDL", return_value=fake) as factory, \
                 patch.object(host,"send") as emit, \
                 patch.object(host,"options", return_value={}):
                if mode == "audio":
                    host.worker_download(URL,None,"mp3")
                else:
                    host.worker_download(URL,144,None,"mp4")
                opts=factory.call_args.args[0]
                self.assertEqual(Path(opts["outtmpl"]).parent,root/"Downloads")
                self.assertTrue((root/"Downloads").is_dir())
                self.assertFalse((root/"Downloads"/"Muzik").exists())
                self.assertEqual(emit.call_args.args[0]["type"],"complete")
                self.assertEqual(emit.call_args.args[0]["filename"],str(root/"Downloads"))
    def test_audio_saved_at_downloads_root(self):
        self.exercise("audio")
    def test_video_saved_at_downloads_root(self):
        self.exercise("video")

if __name__=="__main__":
    unittest.main()
