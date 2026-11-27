#!/usr/bin/env python3
"""Salin tampilan Khenambay dari folder website PHP ke dalam aplikasi Android (app/src/main/assets/www).

Jalankan setiap kali website diubah, lalu Run lagi di Android Studio:

    python siapkan-aset-web.py                 # memakai ../khenambay-php
    python siapkan-aset-web.py C:/xampp/htdocs/khenambay

Yang disalin hanya berkas tampilan (HTML/CSS/JS/gambar). Berkas PHP, database MySQL, dan folder data
tidak ikut, karena di aplikasi semua API dijalankan oleh local-api.js langsung di HP.
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'khenambay-php'))
DST = os.path.join(HERE, 'app', 'src', 'main', 'assets', 'www')

FILES = ['app.js', 'local-api.js', 'stamp.js', 'papua.js', 'motion.js', 'map3d.js', 'realmap.js',
         'styles.css', 'theme-senja.css', 'theme-genz.css', 'layout-web.css', 'motion.css', 'theme-papua.css']
DIRS = ['vendor', 'icons', 'img', 'fonts', os.path.join('database', 'contoh')]


def main():
    if not os.path.isfile(os.path.join(SRC, 'index.php')):
        sys.exit(f'Folder website tidak ditemukan: {SRC}')
    if os.path.isdir(DST):
        shutil.rmtree(DST)
    os.makedirs(DST)
    for f in FILES:
        shutil.copy2(os.path.join(SRC, f), os.path.join(DST, f))
    for d in DIRS:
        if os.path.isdir(os.path.join(SRC, d)):
            shutil.copytree(os.path.join(SRC, d), os.path.join(DST, d))

    html = open(os.path.join(SRC, 'index.php'), encoding='utf-8').read()
    html = html[html.index('<!doctype html>'):]                          # buang kode PHP di atas
    core = open(os.path.join(SRC, 'app', 'core.php'), encoding='utf-8').read()
    importmap = re.search(r"const IMPORTMAP = '(.*?)';", core).group(1)
    html = html.replace('<?= IMPORTMAP ?>', importmap)
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)            # aplikasi tidak perlu manifest PWA
    html = html.replace('<script src="app.js"></script>', '<script src="local-api.js"></script>\n<script src="app.js"></script>')
    if '<?' in html:
        sys.exit('Masih ada kode PHP di index.php yang belum diganti')
    open(os.path.join(DST, 'index.html'), 'w', encoding='utf-8').write(html)

    n = sum(len(fs) for _, _, fs in os.walk(DST))
    print(f'Selesai: {n} berkas disalin ke {os.path.relpath(DST, HERE)}')


if __name__ == '__main__':
    main()
