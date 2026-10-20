#!/usr/bin/env python3
"""Baut aus src/ die fertigen Einzeldateien in dist/:

  dist/kalea-ride.html          eine Datei, lädt three.js + Schrift aus dem Netz (zum Teilen/Öffnen im Browser)
  dist/kalea-ride-offline.html  eine Datei, alles eingebettet – läuft ganz ohne Internet (braucht `npm install`)
  dist/artifact.html            Fassung für ein Claude-Artefakt (ohne <html>/<head>/<body>)

Aufruf (im Repo-Hauptordner):  python3 tools/build.py
"""
import base64, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DIST, NM = (os.path.join(ROOT, p) for p in ('src', 'dist', 'node_modules'))

def read(p):
    with open(p, encoding='utf-8') as fh:
        return fh.read()

def inline_scripts(html):
    """<script src="lokale-datei.js"></script> → eingebetteter <script>…</script>."""
    def rep(m):
        code = read(os.path.join(SRC, m.group(1))).rstrip('\n').replace('</script', '<\\/script')
        return '<script>\n' + code + '\n</script>'
    html = re.sub(r'<!-- Daten und Programm:[^\n]*-->\n', '', html)
    return re.sub(r'<script src="((?:data/)?[\w.-]+\.js)"></script>', rep, html)

def write(name, text):
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(DIST, name), 'w', encoding='utf-8') as fh:
        fh.write(text)
    print(f'{name:28s} {len(text.encode()) // 1024:6d} KB')

def build_online(html):
    return html

def build_offline(html):
    need = {
        'three': os.path.join(NM, 'three/build/three.min.js'),
        'mqtt': os.path.join(NM, 'mqtt/dist/mqtt.min.js'),
        'font': os.path.join(NM, '@fontsource/fredoka/files/fredoka-latin-400-normal.woff2'),
    }
    missing = [k for k, p in need.items() if not os.path.exists(p)]
    if missing:
        print('Offline-Fassung übersprungen – erst `npm install` ausführen (fehlt: ' + ', '.join(missing) + ')')
        return None
    fd = os.path.join(NM, '@fontsource/fredoka/files/')
    faces = ''.join(
        "@font-face{font-family:'Fredoka';font-style:normal;font-weight:%d;font-display:swap;"
        "src:url(data:font/woff2;base64,%s) format('woff2')}\n"
        % (w, base64.b64encode(open(fd + 'fredoka-latin-%d-normal.woff2' % w, 'rb').read()).decode())
        for w in (400, 500, 600, 700))
    a = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">\n<style>\n')
    assert a in html, 'Schrift-Link in src/index.html nicht gefunden'
    html = html.replace(a, '<meta name="apple-mobile-web-app-capable" content="yes">\n<style>\n'
                           '/* Schrift Fredoka (SIL Open Font License) eingebettet */\n' + faces)
    b = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
    assert b in html, 'three.js-Link in src/index.html nicht gefunden'
    html = html.replace(b,
        '<script>/* three.js r128 – MIT-Lizenz */\n' + read(need['three']).replace('</script', '<\\/script') + '\n</script>\n'
        '<script>/* MQTT.js 4.3.7 – MIT-Lizenz (nur für den Online-Modus) */\n'
        + read(need['mqtt']).replace('</script', '<\\/script') + '\n</script>')
    return html

def build_artifact(html):
    head = ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Kalea Ride</title>\n')
    assert html.startswith(head), 'Kopf von src/index.html hat sich geändert – build_artifact anpassen'
    t = html.replace(head, '<title>Kalea Ride</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n', 1)
    t = t.replace('</head>\n<body>\n', '', 1).replace('</body>\n</html>', '')
    assert '<html' not in t[:500] and '<body>' not in t
    return t

if __name__ == '__main__':
    html = inline_scripts(read(os.path.join(SRC, 'index.html')))
    write('kalea-ride.html', build_online(html))
    off = build_offline(html)
    if off:
        write('kalea-ride-offline.html', off)
    write('artifact.html', build_artifact(html))
