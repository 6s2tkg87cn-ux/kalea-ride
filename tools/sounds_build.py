#!/usr/bin/env python3
"""Fahrgeräusche aus Felix' Aufnahmen schneiden und als src/data/sounds.js einbetten.

Die Original-Aufnahmen enthalten Sprache (Ansagen) und liegen NICHT im Repository.
Aufruf:  python3 tools/sounds_build.py <ordner>
Im Ordner erwartet (m4a/wav, Mono reicht):
  aufnahme1  „Hochschalten, nochmal, Runterschalten, nochmal“ (Schaltwerk hinten)
  aufnahme2  „Aufs große Kettenblatt, aufs kleine Kettenblatt“ (Umwerfer vorne)
  aufnahme3  „Fahrgeräusche“ (gleichmäßiges Treten, Kette)
  aufnahme4  „Freilauf … jetzt“ (Rad läuft im Freilauf aus)
Braucht ffmpeg, numpy, scipy und soundfile.

Bearbeitung je Klang: Rauschunterdrückung (spektral, Rauschprofil aus einer ruhigen Stelle derselben
Aufnahme), EQ (Rumpeln weg, weniger Mulm, mehr Präsenz), sanfte Kompression, Normalisierung.

Ergebnis: const SOUNDS = {name: 'data:…;base64,…'}. Kurze Klänge als MP3, Schleifen als WAV
(MP3 hat am Anfang eine Encoder-Pause und würde beim Wiederholen hörbar stocken).
"""
import base64, glob, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'sounds.js')

# Ruhige Stellen je Aufnahme für das Rauschprofil (Raum; bei aufnahme2 läuft im Hintergrund die Kette)
NOISE = {1: (0.3, 2.0), 2: (5.4, 7.0), 3: (0.15, 0.8), 4: None}
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


def denoise(y, noise, sr, reduce_db=18, thresh_db=6):
    """Spektrales Gate: Frequenzanteile nahe am Rauschprofil werden um bis zu reduce_db abgesenkt."""
    n = 1024
    _, _, N = signal.stft(noise, sr, nperseg=n)
    _, _, Y = signal.stft(y, sr, nperseg=n)
    ndb = 20 * np.log10(np.abs(N) + 1e-10)
    lim = ndb.mean(axis=1, keepdims=True) + ndb.std(axis=1, keepdims=True) + thresh_db
    ydb = 20 * np.log10(np.abs(Y) + 1e-10)
    m = 1 / (1 + np.exp(-(ydb - lim) / 2.5))                       # weich: 0 = Rauschen, 1 = Signal
    m = signal.convolve2d(m, np.ones((3, 5)) / 15, mode='same', boundary='symm')  # über Zeit/Frequenz glätten
    floor = 10 ** (-reduce_db / 20)
    _, out = signal.istft(Y * (floor + (1 - floor) * m), sr, nperseg=n)
    return out[:len(y)]


def biquad(kind, f, sr, gain_db=0.0, q=0.707):
    """EQ-Filter nach dem RBJ-Kochbuch: 'hp', 'peak', 'lowshelf', 'highshelf'."""
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f / sr
    c, a = np.cos(w), np.sin(w) / (2 * q)
    if kind == 'hp':
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; d = [1 + a, -2 * c, 1 - a]
    elif kind == 'peak':
        b = [1 + a * A, -2 * c, 1 - a * A]; d = [1 + a / A, -2 * c, 1 - a / A]
    else:
        s = 1 if kind == 'lowshelf' else -1
        r = 2 * np.sqrt(A) * a
        b = [A * ((A + 1) - s * (A - 1) * c + r), s * 2 * A * ((A - 1) - s * (A + 1) * c), A * ((A + 1) - s * (A - 1) * c - r)]
        d = [(A + 1) + s * (A - 1) * c + r, -s * 2 * ((A - 1) + s * (A + 1) * c), (A + 1) + s * (A - 1) * c - r]
    return np.array(b) / d[0], np.array(d) / d[0]


def eq(y, sr, bands):
    for band in bands:
        b, a = biquad(*band[:1], band[1], sr, *band[2:])
        y = signal.lfilter(b, a, y)
    return y


def compress(y, sr, thresh_db=-24, ratio=3.0, attack=0.005, release=0.12):
    """Einfacher Kompressor (Spitzenwert-Hüllkurve), danach wird ohnehin normalisiert."""
    env, out = 0.0, np.empty_like(y)
    ka, kr = np.exp(-1 / (attack * sr)), np.exp(-1 / (release * sr))
    for i, v in enumerate(np.abs(y)):
        env = ka * env + (1 - ka) * v if v > env else kr * env + (1 - kr) * v
        over = 20 * np.log10(env + 1e-9) - thresh_db
        out[i] = y[i] * (10 ** (-over * (1 - 1 / ratio) / 20) if over > 0 else 1.0)
    return out


# EQ: Rumpeln weg, Mulm (250–400 Hz) etwas weniger, Präsenz/Klarheit etwas mehr
EQ_SHOT = [('hp', 90), ('peak', 320, -3.5, 1.0), ('peak', 3200, 3.0, 0.9), ('highshelf', 8000, 2.0)]
EQ_DRIVE = [('hp', 110), ('peak', 280, -3.0, 1.0), ('peak', 2500, 2.5, 0.9)]
EQ_FREE = [('hp', 140), ('peak', 350, -2.0, 1.0), ('peak', 5000, -2.5, 1.2), ('peak', 1800, 2.0, 1.0)]


def clean(rec, n, a, b, eqb, comp, reduce_db=18):
    """Ausschnitt rauschbefreien, entzerren und komprimieren (mit etwas Vorlauf, damit Filter einschwingen)."""
    x, sr = rec[n]
    pad = int(0.15 * sr)
    i0, i1 = max(0, int(a * sr) - pad), int(b * sr) + pad
    y = x[i0:i1]
    if NOISE[n]:
        y = denoise(y, x[int(NOISE[n][0] * sr):int(NOISE[n][1] * sr)], sr, reduce_db)
    y = eq(y, sr, eqb)
    y = y[int(a * sr) - i0:int(a * sr) - i0 + int((b - a) * sr)]
    if comp:
        y = compress(y / np.abs(y).max(), sr, *comp)
    return y


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
        sr = rec[n][1]
        y = fade(clean(rec, n, a, b, EQ_SHOT, (-20, 2.5, 0.004, 0.08)), sr)  # schnelle Spitzen bleiben, Ausklang hörbarer
        out[name] = encode(y * 0.7 / np.abs(y).max(), sr, 'mp3')
    for name, (n, a, b, rms) in LOOPS.items():
        sr = rec[n][1]
        y = seamless(clean(rec, n, a, b, EQ_DRIVE if name == 'drive' else EQ_FREE, (-18, 3.0, 0.01, 0.15), 9), sr)  # Kette: Nutzsignal nur knapp über dem Raumrauschen → behutsam
        out[name] = encode(np.clip(y * rms / np.sqrt(np.mean(y ** 2)), -0.98, 0.98), sr, 'wav')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Fahrgeräusche aus eigenen Aufnahmen (tools/sounds_build.py) – Schaltwerk, Umwerfer, Kette, Freilauf\n')
        f.write('const SOUNDS={' + ','.join(f'{k}:"{v}"' for k, v in out.items()) + '};\n')
    print(f'{OUT}: {os.path.getsize(OUT) // 1024} KB, {len(out)} Klänge')


if __name__ == '__main__':
    main()
