"""Register Windows native messaging bridge for a specific extension ID.
Run with an active local Python interpreter (preferably venv after installing requirements).
"""
import argparse
import json
import os
from pathlib import Path
import re
import sys

NAME = 'com.acikvideo.indirici'

def main():
    if os.name != 'nt':
        raise SystemExit('Bu kurulum Windows içindir.')
    import winreg
    parser = argparse.ArgumentParser()
    parser.add_argument('--extension-id', required=True)
    parser.add_argument('--browser', choices=['chrome', 'edge', 'both'], default='chrome')
    args = parser.parse_args()
    if not re.fullmatch('[a-p]{32}', args.extension_id):
        raise SystemExit('Chrome/Edge eklenti kimliği geçersiz.')
    here = Path(__file__).resolve().parent
    launcher = here / 'run_host.cmd'
    # quote paths; no untrusted args are forwarded
    launcher.write_text('@echo off\r\n"' + sys.executable + '" -u "' + str(here / 'native_host.py') + '"\r\n', encoding='utf-8')
    manifest = {'name': NAME, 'description': 'Açık Video İndirici yerel köprüsü',
                'path': str(launcher), 'type': 'stdio',
                'allowed_origins': ['chrome-extension://' + args.extension_id + '/']}
    path = here / 'native_manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    targets = ['Google\\Chrome', 'Microsoft\\Edge'] if args.browser == 'both' else [ 'Google\\Chrome' if args.browser == 'chrome' else 'Microsoft\\Edge' ]
    for target in targets:
        with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, 'SOFTWARE\\' + target + '\\NativeMessagingHosts\\' + NAME, 0, winreg.KEY_WRITE) as key:
            winreg.SetValueEx(key, '', 0, winreg.REG_SZ, str(path))
        print('Kaydedildi: ' + target + ' → ' + str(path))
    print('Tarayıcının uzantılar ekranından eklentiyi yeniden yükleyin.')

if __name__ == '__main__':
    main()
