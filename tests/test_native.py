import importlib.util
from pathlib import Path
import struct
import unittest
import json

spec=importlib.util.spec_from_file_location('native_host',Path(__file__).resolve().parents[1]/'native'/'native_host.py')
host=importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)

class NativeTests(unittest.TestCase):
    def test_allowed_urls(self):
        ID='aB0_-ABcD12'
        for url in [f'https://www.youtube.com/watch?v={ID}&t=123',f'https://youtu.be/{ID}',f'https://www.youtube.com/shorts/{ID}',f'https://m.youtube.com/live/{ID}']:
            self.assertEqual(host.normalize_youtube(url),f'https://www.youtube.com/watch?v={ID}')
    def test_reject_host_and_redirects(self):
        for url in ['http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.tld/watch?v=abcdefghijk',
                    'https://www.youtube.com.evil.tld/watch?v=abcdefghijk','https://www.youtube.com/@user','file:///x',
                    'https://evil.test/watch?v=abcdefghijk','https://youtube.com/watch?v=abcdefghijk&v=other',
                    'https://youtube.com/watch?v=abcdefghijk:443','https://youtube.com:8000/watch?v=abcdefghijk']:
            with self.assertRaises(ValueError,msg=url): host.normalize_youtube(url)
    def test_binary_frame(self):
        msg={'type':'info','title':'Türkçe: Çağrı 🌍'}
        buf=host.pack(msg)
        self.assertEqual(struct.unpack('=I',buf[:4])[0],len(buf[4:]))
        self.assertEqual(json.loads(buf[4:]),msg)

if __name__=='__main__': unittest.main()
