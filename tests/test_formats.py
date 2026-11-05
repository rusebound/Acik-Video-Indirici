import importlib.util
from pathlib import Path
from unittest.mock import patch
import unittest

spec=importlib.util.spec_from_file_location('native_formats',Path(__file__).resolve().parents[1]/'native'/'native_host.py')
host=importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
URL='https://www.youtube.com/watch?v=aqz-KE-bpKQ'
SAMPLE=[
 {'ext':'webm','height':2160,'vcodec':'vp9','acodec':'none'},
 {'ext':'webm','height':1080,'vcodec':'vp9','acodec':'none'},
 {'ext':'mp4','height':1080,'vcodec':'avc1.640028','acodec':'none'},
 {'ext':'mp4','height':720,'vcodec':'av01.0.08','acodec':'none'},
 {'ext':'m4a','vcodec':'none','acodec':'mp4a.40.2'},
 {'ext':'webm','vcodec':'none','acodec':'opus'},
 {'ext':'mp4','height':2160,'vcodec':'avc1.64003','acodec':'none','has_drm':True},
]

class FormatTests(unittest.TestCase):
 def test_compatible_heights_by_container(self):
  actual=host.video_container_options(SAMPLE)
  self.assertEqual(actual,{'mkv':[2160,1080,720],'mp4':[1080],'webm':[2160,1080]})
 def test_no_audio_rejects_unsupported_video_merges(self):
  self.assertEqual(host.video_container_options(SAMPLE[:4]),{'mkv':[],'mp4':[],'webm':[]})
 def test_drm_must_not_appear(self):
  self.assertNotIn(2160,host.video_container_options(SAMPLE)['mp4'])
 def test_exact_mp4_selector_h264_aac(self):
  result=host.download_settings(1080,None,'mp4')
  self.assertIn('vcodec^=avc1',result['format'])
  self.assertIn('acodec^=mp4a',result['format'])
  self.assertEqual(result['merge_output_format'],'mp4')
 def test_mkv_default_and_original_video(self):
  result=host.download_settings(2160)
  self.assertEqual(result['merge_output_format'],'mkv')
  self.assertEqual(result['postprocessors'][0]['key'],'FFmpegVideoRemuxer')
 def test_webm_selector_compatible_sources(self):
  result=host.download_settings(2160,None,'webm')
  self.assertIn('ext=webm',result['format'])
  self.assertEqual(result['merge_output_format'],'webm')
 def test_audio_conversions(self):
  for fmt in ('mp3','m4a','opus','wav','flac'):
   result=host.download_settings(audio_format=fmt)
   self.assertEqual(result['postprocessors'][0]['preferredcodec'],fmt)
  self.assertEqual(host.download_settings(audio_format='original')['format'],'ba[acodec!=none]/bestaudio')
 def test_invalid_formats_and_resolution(self):
  for format in ('exe','txt','zip',''):
   with self.assertRaises(ValueError): host.download_settings(1080,None,format)
   with self.assertRaises(ValueError): host.download_settings(audio_format=format)
  for height in (143,0,4321,1080.0,'1080',None,True):
   with self.assertRaises(ValueError): host.download_settings(height,None,'mkv')
 def test_reject_untrusted_mp4_format(self):
  with patch.object(host,'start_worker') as start,patch.object(host,'send') as send:
   host.handle({'type':'download','url':URL,'height':1080,'video_format':'mov','confirmed':True})
   start.assert_not_called()
   self.assertEqual(send.call_args.args[0]['type'],'error')
 def test_mp4_route(self):
  with patch.object(host,'start_worker') as start:
   host.handle({'type':'download','url':URL,'height':1080,'video_format':'mp4','confirmed':True})
   start.assert_called_once_with(host.worker_download,URL,1080,None,'mp4')

if __name__=='__main__': unittest.main()
