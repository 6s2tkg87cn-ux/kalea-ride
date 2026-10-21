#!/usr/bin/env python3
"""Fahrgeräusche aus Felix' Aufnahmen schneiden und als src/data/sounds.js einbetten.

Die Original-Aufnahmen enthalten Sprache (Ansagen) und liegen NICHT im Repository.
Aufruf:  python3 tools/sounds_build.py <ordner>
Im Ordner erwartet (m4a/wav, Mono reicht):
  aufnahme1  „Hochschalten, nochmal, Runterschalten, nochmal“ (Schaltwerk hinten)
  aufnahme2  „Aufs große Kettenblatt, aufs kleine Kettenblatt“ (Umwerfer vorne)
  aufnahme3  „Fahrgeräusche“ (gleichmäßiges Treten, Kette)
  aufnahme4  „Freilauf … jetzt“ (Rad läuft im Freilauf aus)
Braucht ffmpeg, numpy und soundfile.

Ergebnis: const SOUNDS = {name: 'data:…;base64,…'}. Kurze Klänge als MP3, Schleifen als WAV
(MP3 hat am Anfang eine Encoder-Pause und würde beim Wiederholen hörbar stocken).
"""
import base64, glob, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'sounds.js')

# Schnittstellen in Sekunden (per Spektrogramm und Spracherkennung bestimmt)
SHOTS = {  # name: (aufnahme, von, bis)
    'up1': (1, 4.79, 5.40), 'up2': (1, 7.19, 7.80),          # „Hochschalten“, „nochmal“
    'down1': (1, 10.75, 11.50), 'down2': (1, 13.76, 14.45),  # „Runterschalten“, „nochmal“
    'ringbig': (2, 4.25, 4.95), 'ringsmall': (2, 9.66, 10.30),  # großes Blatt: nur Kettensprung (davor ein harter Stoß)
}
LOOPS = {  # name: (aufnahme, von, bis, Ziel-RMS)
    'drive': (3, 3.0, 7.2, 0.18),
    'free': (4, 10.0, 13.4, 0.18),
}


def load(folder, n):
    src = glob.glob(os.path.join(folder, f'aufnahme{n}.*'))
    if not src:
        sys.exit(f'aufnahme{n}.* fehlt in {folder}')
    tmp = tempfile.mktemp(suffix='.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src[0], '-ac', '1', '-ar', '48000', tmp], check=True)
    x, sr = sf.read(tmp)
    os.remove(tmp)
    return x, sr


def highpass(y, sr, fc=60):  # Rumpeln (Trittschall, Raum) entfernen
    a = np.exp(-2 * np.pi * fc / sr)
    o = np.zeros_like(y)
    p = q = 0.0
    for i, v in enumerate(y):
        p = a * (p + v - q)
        q = v
        o[i] = p
    return o


def fade(y, sr, fi=0.004, fo=0.06):
    y = y.copy()
    n1, n2 = int(fi * sr), int(fo * sr)
    y[:n1] *= np.linspace(0, 1, n1)
    y[-n2:] *= np.linspace(1, 0, n2) ** 2
    return y


def seamless(y, sr, xf=0.35):  # Ende in den Anfang überblenden (gleiche Leistung)
    n = int(xf * sr)
    w = np.sqrt(np.linspace(0, 1, n))
    body = y[n:].copy()
    body[-n:] = body[-n:] * w[::-1] + y[:n] * w
    return body


def encode(y, sr, fmt):
    a = tempfile.mktemp(suffix='.wav')
    b = tempfile.mktemp(suffix='.' + fmt)
    sf.write(a, y, sr)
    if fmt == 'mp3':
        args, mime = ['-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k'], 'audio/mpeg'
    else:
        args, mime = ['-ar', '22050', '-c:a', 'pcm_s16le'], 'audio/wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a, '-ac', '1', *args, b], check=True)
    data = open(b, 'rb').read()
    os.remove(a)
    os.remove(b)
    return f'data:{mime};base64,' + base64.b64encode(data).decode()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder = sys.argv[1]
    rec = {n: load(folder, n) for n in (1, 2, 3, 4)}
    out = {}
    for name, (n, a, b) in SHOTS.items():
        x, sr = rec[n]
        y = fade(highpass(x[int(a * sr):int(b * sr)], sr), sr)
        out[name] = encode(y * 0.7 / np.abs(y).max(), sr, 'mp3')
    for name, (n, a, b, rms) in LOOPS.items():
        x, sr = rec[n]
        y = seamless(highpass(x[int(a * sr):int(b * sr)], sr), sr)
        out[name] = encode(np.clip(y * rms / np.sqrt(np.mean(y ** 2)), -0.98, 0.98), sr, 'wav')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Fahrgeräusche aus eigenen Aufnahmen (tools/sounds_build.py) – Schaltwerk, Umwerfer, Kette, Freilauf\n')
        f.write('const SOUNDS={' + ','.join(f'{k}:"{v}"' for k, v in out.items()) + '};\n')
    print(f'{OUT}: {os.path.getsize(OUT) // 1024} KB, {len(out)} Klänge')


if __name__ == '__main__':
    main()
