import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("native_audio", Path(__file__).resolve().parents[1] / "native" / "native_host.py")
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"

class AudioModeTests(unittest.TestCase):
    def test_audio_mp3_routes_without_height(self):
        with patch.object(host, "start_worker") as start, patch.object(host, "send") as send:
            host.handle({"type":"download","mode":"audio","audio_format":"mp3","url":URL,"confirmed":True})
            start.assert_called_once_with(host.worker_download, URL, None, "mp3")
            self.assertEqual(send.call_args.args[0]["type"],"started")
    def test_audio_original_routes_without_height(self):
        with patch.object(host, "start_worker") as start, patch.object(host, "send") as send:
            host.handle({"type":"download","mode":"audio","audio_format":"original","url":URL,"confirmed":True})
            start.assert_called_once_with(host.worker_download, URL, None, "original")
    def test_video_v2_still_supported(self):
        with patch.object(host, "start_worker") as start, patch.object(host, "send") as send:
            host.handle({"type":"download","mode":"video","height":2160,"url":URL,"confirmed":True})
            start.assert_called_once_with(host.worker_download, URL, 2160)
    def test_audio_rejects_unrecognized_codec(self):
        with patch.object(host, "start_worker") as start, patch.object(host, "send") as send:
            host.handle({"type":"download","mode":"audio","audio_format":"exe","url":URL,"confirmed":True})
            start.assert_not_called()
            self.assertEqual(send.call_args.args[0]["type"],"error")
    def test_missing_rights_rejected(self):
        with patch.object(host, "start_worker") as start, patch.object(host, "send") as send:
            host.handle({"type":"download","mode":"audio","audio_format":"mp3","url":URL,"confirmed":False})
            start.assert_not_called()
            self.assertEqual(send.call_args.args[0]["type"],"error")
    def test_unrecognized_mode_rejected(self):
        with patch.object(host, "start_worker") as start, patch.object(host, "send") as send:
            host.handle({"type":"download","mode":"file","url":URL,"confirmed":True})
            start.assert_not_called()
            self.assertEqual(send.call_args.args[0]["type"],"error")
    def test_untrusted_domain_rejected(self):
        with patch.object(host, "start_worker") as start, patch.object(host, "send") as send:
            host.handle({"type":"download","mode":"audio","audio_format":"mp3",
                         "url":"https://evil.example/watch?v=aqz-KE-bpKQ","confirmed":True})
            start.assert_not_called()
            self.assertEqual(send.call_args.args[0]["type"],"error")
if __name__ == "__main__":
    unittest.main()
