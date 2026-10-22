#!/usr/bin/env python3
"""Neue Ulm-Routen und genaue Flüsse aus ulm-routen.json (tools/ulm-routen-holen.html) erzeugen.

Aufruf:  python3 tools/ulm_routen.py ulm-routen.json
Ergebnis: src/data/ulm-data.js wird ergänzt
  - grid:   Höhenraster (Terrarium-Höhenkacheln, gleiche Quelle wie EU-DEM, +1,41 m wie das alte Raster), größer
  - rivers: Donau, Iller, Blau mit Mittellinie, halber Breite je Seite (aus OSM-Wasserflächen) und Wasserspiegel
  - routes: drei neue Runden (Routing auf OSM-Wegen, Radwege bevorzugt), Höhen aus dem Raster
  - places/zones: Ortschaften und Klöster entlang der neuen Routen
Braucht numpy und Pillow; Höhenkacheln werden in ~/.cache/kalea-terrarium zwischengespeichert.
Daten © OpenStreetMap-Mitwirkende (ODbL); Höhen: Mapzen/AWS Terrain Tiles (u. a. EU-DEM, Copernicus).
"""
import heapq, io, json, math, os, re, subprocess, sys, urllib.request
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data', 'ulm-data.js')
ORIGIN = (48.3985, 9.9925)
KX = 111320 * math.cos(math.radians(ORIGIN[0]))
UY0 = 460
DEM_OFFSET = 1.41          # Terrarium liegt im Mittel 1,41 m unter dem alten EU-DEM-Raster (σ 0,23 m)
CACHE = os.path.expanduser('~/.cache/kalea-terrarium')


def ll2xz(lat, lon):
    return (lon - ORIGIN[1]) * KX, -(lat - ORIGIN[0]) * 110540


def xz2ll(x, z):
    return ORIGIN[0] - z / 110540, ORIGIN[1] + x / KX


# ---------------- Höhen ----------------
class Dem:
    Z = 13

    def __init__(self, s, w, n, e):
        tx, ty = self.tx, self.ty
        self.X0, X1, self.Y0, Y1 = int(tx(w)), int(tx(e)), int(ty(n)), int(ty(s))
        self.M = np.zeros(((Y1 - self.Y0 + 1) * 256, (X1 - self.X0 + 1) * 256))
        os.makedirs(CACHE, exist_ok=True)
        for x in range(self.X0, X1 + 1):
            for y in range(self.Y0, Y1 + 1):
                p = f'{CACHE}/{self.Z}_{x}_{y}.png'
                if not os.path.exists(p):
                    url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{self.Z}/{x}/{y}.png'
                    open(p, 'wb').write(urllib.request.urlopen(url, timeout=60).read())
                a = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
                self.M[(y - self.Y0) * 256:(y - self.Y0 + 1) * 256, (x - self.X0) * 256:(x - self.X0 + 1) * 256] = \
                    a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768

    def tx(self, lon):
        return (lon + 180) / 360 * 2 ** self.Z

    def ty(self, lat):
        r = math.radians(lat)
        return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** self.Z

    def h(self, x, z):
        lat, lon = xz2ll(x, z)
        px = (self.tx(lon) - self.X0) * 256 - 0.5
        py = (self.ty(lat) - self.Y0) * 256 - 0.5
        i, j = int(px), int(py)
        fx, fy = px - i, py - j
        M = self.M
        return (M[j, i] * (1 - fx) * (1 - fy) + M[j, i + 1] * fx * (1 - fy) + M[j + 1, i] * (1 - fx) * fy
                + M[j + 1, i + 1] * fx * fy) + DEM_OFFSET


# ---------------- Geometrie-Helfer ----------------
def pip(P, x, z):
    c = False
    j = len(P) - 1
    for i in range(len(P)):
        ax, az = P[i]
        bx, bz = P[j]
        if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax:
            c = not c
        j = i
    return c


def resample(pts, step):
    out = [pts[0]]
    acc = 0.0
    for a, b in zip(pts, pts[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        t = step - acc
        while t <= l:
            out.append((a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l))
            t += step
        acc = (acc + l) % step
    if math.hypot(out[-1][0] - pts[-1][0], out[-1][1] - pts[-1][1]) > step * 0.3:
        out.append(pts[-1])
    return out


def smooth(v, w):
    v = np.asarray(v, dtype=float)
    if w < 1:
        return v
    k = np.ones(2 * w + 1) / (2 * w + 1)
    p = np.pad(v, w, mode='edge')
    return np.convolve(p, k, mode='valid')


# ---------------- OSM-Daten ----------------
class Osm:
    def __init__(self, path):
        d = json.load(open(path, encoding='utf-8'))
        self.d = d
        nl = np.array(d['nl'], dtype=np.float64).reshape(-1, 2) / 1e5
        self.lat, self.lon = nl[:, 0], nl[:, 1]
        self.x = (self.lon - ORIGIN[1]) * KX
        self.z = -(self.lat - ORIGIN[0]) * 110540
        self.bbox = d['bbox']

    @staticmethod
    def flat2xz(flat):
        return [ll2xz(flat[i] / 1e5, flat[i + 1] / 1e5) for i in range(0, len(flat), 2)]


# ---------------- Flüsse ----------------
MASK_RES = 4.0


def water_mask(osm):
    """Alle Fluss-Wasserflächen als Bild (4-m-Raster): 1 = Wasser."""
    s, w, n, e = osm.bbox['s'], osm.bbox['w'], osm.bbox['n'], osm.bbox['e']
    x0, z0 = ll2xz(n, w)
    x1, z1 = ll2xz(s, e)
    W, H = int((x1 - x0) / MASK_RES) + 1, int((z1 - z0) / MASK_RES) + 1
    img = Image.new('L', (W, H), 0)
    from PIL import ImageDraw
    dr = ImageDraw.Draw(img)
    px = lambda p: ((p[0] - x0) / MASK_RES, (p[1] - z0) / MASK_RES)
    for typ, name, rings in osm.d['areas']:
        if typ not in ('river', 'riverbank', 'oxbow', 'canal'):
            continue
        for role, flat in rings:
            if role == 'outer' and len(flat) >= 6:
                dr.polygon([px(p) for p in Osm.flat2xz(flat)], fill=1)
        for role, flat in rings:
            if role == 'inner' and len(flat) >= 6:
                dr.polygon([px(p) for p in Osm.flat2xz(flat)], fill=0)
    return np.asarray(img), x0, z0


def chain(segs):
    """Wasserlauf-Stücke (jeweils flussabwärts gerichtet) zu einer Linie verbinden: vom obersten Anfang immer weiter."""
    starts = {}
    for s in segs:
        starts.setdefault(s[0], []).append(s)
    ends = {s[-1] for s in segs}
    heads = [s for s in segs if s[0] not in ends] or segs
    best = []
    for h in heads:
        line, cur, seen = list(h), h, {id(h)}
        while True:
            nxt = [s for s in starts.get(cur[-1], []) if id(s) not in seen]
            if not nxt:
                break
            cur = max(nxt, key=len)
            seen.add(id(cur))
            line += cur[1:]
        if len(line) > len(best):
            best = line
    return best


def river_line(osm, names, step=20.0, clip=None):
    segs = [tuple((w[3][i], w[3][i + 1]) for i in range(0, len(w[3]), 2)) for w in osm.d['water'] if w[1] in names and w[0] in ('river', 'canal', 'stream')]
    line = chain(segs)
    pts = [ll2xz(a / 1e5, b / 1e5) for a, b in line]
    if clip:
        x0, z0, x1, z1 = clip
        idx = [i for i, p in enumerate(pts) if x0 <= p[0] <= x1 and z0 <= p[1] <= z1]
        pts = pts[idx[0]:idx[-1] + 1]
    return resample(pts, step)


def river_widths(pts, mask, mx0, mz0, default, maxw=90):
    H, W = mask.shape

    def wet(x, z):
        i, j = int((x - mx0) / MASK_RES), int((z - mz0) / MASK_RES)
        return 0 <= i < W and 0 <= j < H and mask[j, i] > 0
    out = []
    for k, p in enumerate(pts):
        a, b = pts[max(0, k - 2)], pts[min(len(pts) - 1, k + 2)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        l = math.hypot(tx, tz) or 1
        tx, tz = tx / l, tz / l
        if not wet(*p):
            out.append([default, default, 0])
            continue
        ws = []
        for sd in (1, -1):          # +1 = Seite (-tz, tx) wie in der App (RIVW.p)
            t = 0.0
            while t < maxw and wet(p[0] - tz * sd * t, p[1] + tx * sd * t):
                t += 1.0
            ws.append(t)
        out.append([ws[0], ws[1], 1])
    A = np.array(out, dtype=float)
    for c in (0, 1):                # Ausreißer (Brücken, Inseln) glätten
        v = A[:, c].copy()
        med = np.array([np.median(v[max(0, i - 3):i + 4]) for i in range(len(v))])
        A[:, c] = smooth(med, 2)
    return A


WATER_DONAU_ULM = 465.6     # Wasserspiegel der Donau an der Herdbrücke (wie bisher in der App)


def water_level(pts, dem, off):
    """Wasserspiegel: Höhenmodell entlang der Mitte (über dem Wasser zu hoch), geglättet, flussabwärts nie steigend."""
    h = np.array([dem.h(*p) for p in pts])
    h = smooth(np.array([h[max(0, i - 10):i + 11].min() for i in range(len(h))]), 8) - off
    for i in range(1, len(h)):
        h[i] = min(h[i], h[i - 1])
    return h


def build_rivers(osm, dem):
    mask, mx0, mz0 = water_mask(osm)
    bb = osm.bbox
    x0, z0 = ll2xz(bb['n'], bb['w'])
    x1, z1 = ll2xz(bb['s'], bb['e'])
    clip = (x0 + 200, z0 + 200, x1 - 200, z1 - 200)
    out = []
    # Donau (Index 0 = Hauptfluss)
    pts = river_line(osm, ('Donau',), clip=clip)
    W = river_widths(pts, mask, mx0, mz0, 30)
    ref = min(range(len(pts)), key=lambda i: math.hypot(*np.subtract(pts[i], ll2xz(48.3952, 9.9982))))
    raw = np.array([dem.h(*p) for p in pts])
    off = smooth(np.array([raw[max(0, i - 10):i + 11].min() for i in range(len(raw))]), 8)[ref] - WATER_DONAU_ULM
    wyD = water_level(pts, dem, off)
    out.append(('Donau', pts, W, wyD))
    donau = pts
    # Iller: an der Mündung auf Donau-Höhe
    pts = river_line(osm, ('Iller',), clip=clip)
    W = river_widths(pts, mask, mx0, mz0, 20)
    mouth = min(range(len(donau)), key=lambda i: math.hypot(*np.subtract(donau[i], pts[-1])))
    raw = np.array([dem.h(*p) for p in pts])
    off = smooth(np.array([raw[max(0, i - 10):i + 11].min() for i in range(len(raw))]), 8)[-1] - (wyD[mouth] + 0.3)
    out.append(('Iller', pts, W, water_level(pts, dem, off)))
    # Blau: schmal, Wasserspiegel knapp unter der Talsohle; in der Innenstadt (Kanäle) endet sie
    pts = [p for p in river_line(osm, ('Blau', 'Große Blau'), clip=clip) if p[0] < -900]
    W = river_widths(pts, mask, mx0, mz0, 4.5, maxw=15)
    out.append(('Blau', pts, W, water_level(pts, dem, 2.0)))
    res = []
    for name, pts, W, wy in out:
        res.append({'n': name, 'p': [[round(p[0], 1), round(p[1], 1), round(float(w[0]), 1), round(float(w[1]), 1), round(float(h), 2)]
                                     for p, w, h in zip(pts, W, wy)]})
        print(f'{name}: {len(pts) * 20 / 1000:.1f} km, halbe Breite Median {np.median(W[:, 0]):.0f}/{np.median(W[:, 1]):.0f} m, '
              f'Wasser {wy[0]:.1f} → {wy[-1]:.1f} m')
    return res


# ---------------- Routing ----------------
BASE = {'cycleway': 1.0, 'path': 1.6, 'footway': 1.5, 'pedestrian': 1.6, 'bridleway': 2.0, 'track': 1.3,
        'residential': 1.05, 'living_street': 1.15, 'service': 1.4, 'unclassified': 1.1, 'road': 1.5,
        'tertiary': 1.25, 'tertiary_link': 1.25, 'secondary': 1.7, 'secondary_link': 1.7, 'primary': 3.0, 'primary_link': 3.0}
PAVED = {'asphalt', 'concrete', 'paved', 'concrete:plates', 'paving_stones', 'chipseal'}
ROUGH = {'sett': 1.3, 'cobblestone': 1.5, 'unhewn_cobblestone': 1.6, 'compacted': 1.25, 'fine_gravel': 1.3,
         'gravel': 1.8, 'unpaved': 1.8, 'dirt': 2.2, 'ground': 2.2, 'grass': 2.5, 'pebblestone': 2.0, 'earth': 2.2, 'mud': 3.0}


class Graph:
    def __init__(self, osm):
        self.osm = osm
        relw = {}
        for rid, name, ref, net, members in osm.d['rels']:
            for wid, role in members:
                relw.setdefault(wid, name or ref)
        self.adj = {}
        self.way = {}
        for wid, hw, name, surf, bic, fl, tt, layer, ms, nd in osm.d['ways']:
            c = BASE.get(hw, 2.0)
            if hw in ('path', 'footway', 'pedestrian') and bic in ('designated', 'yes'):
                c = 1.05 if surf in PAVED else 1.35
            if hw == 'track':
                c = 1.05 if (tt == 'grade1' or surf in PAVED) else 1.4 if tt == 'grade2' else 1.9
            if surf in ROUGH:
                c *= ROUGH[surf]
            elif surf not in PAVED and hw in ('path', 'footway', 'bridleway'):
                c *= 1.4
            if fl & 64 and hw in ('tertiary', 'secondary', 'primary'):
                c *= 0.8
            m = re.match(r'\d+', ms or '')
            if m and int(m.group()) >= 70:
                c *= 1.4
            if wid in relw:
                c *= 0.72
            info = dict(hw=hw, name=name, surf=surf, rel=relw.get(wid, ''), bridge=bool(fl & 1), tunnel=bool(fl & 2))
            fwd = not (fl & 8) or bool(fl & 16)
            bwd = not (fl & 4) or bool(fl & 16)
            for a, b in zip(nd, nd[1:]):
                l = math.hypot(osm.x[a] - osm.x[b], osm.z[a] - osm.z[b])
                if fwd:
                    self.adj.setdefault(a, []).append((b, l * c, l, wid))
                if bwd:
                    self.adj.setdefault(b, []).append((a, l * c, l, wid))
            self.way[wid] = info
        # nur das größte zusammenhängende Wegenetz verwenden (abgeschnittene Stummel am Rand weglassen)
        und = {}
        for u, lst in self.adj.items():
            for v, *_ in lst:
                und.setdefault(u, set()).add(v)
                und.setdefault(v, set()).add(u)
        seen, best = set(), set()
        for s0 in und:
            if s0 in seen:
                continue
            comp, st = {s0}, [s0]
            seen.add(s0)
            while st:
                u = st.pop()
                for v in und[u]:
                    if v not in seen:
                        seen.add(v)
                        comp.add(v)
                        st.append(v)
            if len(comp) > len(best):
                best = comp
        self.nodes = np.array(sorted(n for n in best if n in self.adj))

    def nearest(self, lat, lon, avoid=('primary', 'primary_link', 'secondary')):
        x, z = ll2xz(lat, lon)
        ok = [n for n in self.nodes if all(self.way[w]['hw'] not in avoid for _, _, _, w in self.adj[n])]
        ok = np.array(ok)
        d = np.hypot(self.osm.x[ok] - x, self.osm.z[ok] - z)
        return int(ok[np.argmin(d)])

    def route(self, a, b, used=None, reuse=1.0):
        """Dijkstra; bereits befahrene Kanten (used) kosten mehr, damit die Runde nicht hin und zurück führt."""
        dist, prev, pq = {a: 0.0}, {}, [(0.0, a)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == b:
                break
            if d > dist.get(u, 1e18):
                continue
            for v, c, l, w in self.adj.get(u, []):
                if used and ((u, v) in used or (v, u) in used):
                    c *= reuse
                nd = d + c
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    prev[v] = (u, w)
                    heapq.heappush(pq, (nd, v))
        if b not in prev and a != b:
            raise RuntimeError('kein Weg gefunden')
        path, cur = [(b, None)], b
        while cur != a:
            cur, w = prev[cur]
            path.append((cur, w))
        path.reverse()
        return path                 # [(Knoten, Weg zum nächsten Knoten), …, (Ziel, None)]


# ---------------- Routen bauen ----------------
HW_NAME = {'cycleway': 'Radweg', 'track': 'Feldweg', 'path': 'Weg', 'footway': 'Fußweg', 'pedestrian': 'Fußgängerzone',
           'service': 'Zufahrt', 'residential': 'Wohnstraße', 'living_street': 'Spielstraße', 'unclassified': 'Verbindungsstraße'}
REL_SHORT = [('Donauradweg', 'Donauradweg'), ('Donauroute', 'Donauradweg'), ('EuroVelo 6', 'Donauradweg'), ('Iller-Radweg', 'Iller-Radweg'),
             ('Eiszeittäler', 'Blautal-Radweg'), ('Oberschwaben-Allgäu', 'Radweg'), ('Wasserspuren', 'Donauradweg')]


def label(info):
    if info['name']:
        return info['name']
    for k, v in REL_SHORT:
        if k in info['rel']:
            return v
    return HW_NAME.get(info['hw'], 'Straße')


def build_route(G, dem, wps, rid, name, desc, climb_names):
    osm = G.osm
    nodes = [G.nearest(*p) for p in wps]
    full, used = [], set()
    for a, b in zip(nodes, nodes[1:] + nodes[:1]):
        seg = G.route(a, b, used, 4.0)
        used |= {(seg[i][0], seg[i + 1][0]) for i in range(len(seg) - 1)}
        full = full[:-1] + seg if full else seg
    # dicht abtasten (≤ 5 m), Weg-Infos mitnehmen
    P, info = [], []
    for (n, w), (m, _) in zip(full, full[1:]):
        a, b = (osm.x[n], osm.z[n]), (osm.x[m], osm.z[m])
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        k = max(1, int(math.ceil(l / 5)))
        for q in range(k):
            P.append((a[0] + (b[0] - a[0]) * q / k, a[1] + (b[1] - a[1]) * q / k))
            info.append(G.way[w])
    P = np.array(P)
    # Hin- und Rückweg teilen sich am Start oft dieselbe Straße: dieses doppelte Stück abschneiden,
    # damit die Runde sauber schließt (Start = erster Punkt, der nicht mehr neben dem Rückweg liegt)
    tail = np.arange(len(P) - min(len(P) // 3, 200), len(P))
    i0, j0 = 0, len(P) - 1
    for i in range(min(len(P) // 3, 200)):
        dd = np.hypot(P[tail, 0] - P[i, 0], P[tail, 1] - P[i, 1])
        if dd.min() < 14:
            i0, j0 = i, int(tail[np.argmin(dd)])
    if i0:
        P, info = P[i0 + 1:j0], info[i0 + 1:j0]
    # Ecken leicht runden (gleitendes Mittel über ±10 m), Start bleibt fest
    Q = P.copy()
    for _ in range(2):
        Q[2:-2] = (Q[:-4] + Q[1:-3] + Q[2:-2] + Q[3:-1] + Q[4:]) / 5
    # Höhen: Gelände; auf Brücken/in Tunneln geradlinig zwischen den Enden; dann glätten
    h = np.array([dem.h(x, z) for x, z in Q])
    br = np.array([i['bridge'] or i['tunnel'] for i in info])
    i = 0
    while i < len(h):
        if br[i]:
            j = i
            while j < len(h) and br[j]:
                j += 1
            a, b = max(0, i - 1), min(len(h) - 1, j)
            h[a:b + 1] = np.linspace(h[a], h[b], b - a + 1)
            i = j
        else:
            i += 1
    h = smooth(smooth(h, 7), 7)       # Rauschen des Höhenmodells (Häuser, Böschungen) über ±35 m glätten
    # nur jeden 2. Punkt behalten (10 m Abstand; die App tastet ohnehin neu ab)
    keep = list(range(0, len(Q), 2))
    Q, h, info = Q[keep], h[keep], [info[i] for i in keep]
    # Abstände
    d = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))])
    L = float(d[-1])
    gain = float(np.clip(np.diff(h), 0, None).sum())
    # Straßennamen-Abschnitte (kurze Stücke < 80 m dem Vorgänger zuschlagen)
    segs = []
    for k, inf in enumerate(info):
        lb = label(inf)
        if not segs or segs[-1][1] != lb:
            segs.append([k, lb])
    merged = []
    for s, nxt in zip(segs, segs[1:] + [[len(info), None]]):
        if merged and d[min(nxt[0], len(d) - 1)] - d[s[0]] < 80:
            continue
        if merged and merged[-1][1] == s[1]:
            continue
        merged.append(s)
    # Anstiege: Tal → Gipfel, mind. 25 Hm und Ø ≥ 3 %
    hs = smooth(h, 10)
    climbs, i0 = [], 0
    ext, dirn, cand = [(0, hs[0])], 1, (0, hs[0])
    for k in range(1, len(hs)):
        if dirn > 0:
            if hs[k] > cand[1]:
                cand = (k, hs[k])
            elif cand[1] - hs[k] > 10:
                ext.append(cand); dirn = -1; cand = (k, hs[k])
        else:
            if hs[k] < cand[1]:
                cand = (k, hs[k])
            elif hs[k] - cand[1] > 10:
                ext.append(cand); dirn = 1; cand = (k, hs[k])
    ext.append(cand)
    peaks = [e for k, e in enumerate(ext) if (k == 0 or e[1] > ext[k - 1][1]) and (k == len(ext) - 1 or e[1] > ext[k + 1][1])]
    W = 20                          # 200 m
    prev = 0
    for b, hb in peaks:
        # Fuß = tiefster Punkt seit dem letzten Gipfel; flache Anläufe am Anfang und flache Kuppen am Ende abschneiden
        # Fuß: wo es dahinter flacher als 2 % wird (Minimum von Höhe + 2 % × Abstand zum Gipfel)
        a = prev + int(np.argmin(hs[prev:b + 1] + 0.02 * (d[b] - d[prev:b + 1])))
        prev = b
        while b > a + W and hs[b] - hs[b - W] < 0.01 * (d[b] - d[b - W]):
            b -= 1
        ln, g = d[b] - d[a], hs[b] - hs[a]
        if g < 25 or ln < 300 or g / ln < 0.03 or any(c['start'] <= d[a] <= c['end'] for c in climbs):
            continue
        mx = max((hs[k + 10] - hs[k]) / max(1, d[k + 10] - d[k]) for k in range(a, max(a + 1, b - 10)))
        climbs.append({'name': '', 'start': round(float(d[a]), 1), 'end': round(float(d[b]), 1), 'len': round(float(ln), 1),
                       'gain': round(float(g), 1), 'avg': round(float(g / ln * 100), 1), 'max': round(float(mx * 100), 2), 'top': round(float(hs[b]), 1)})
    climbs.sort(key=lambda c: c['start'])
    for k, c in enumerate(climbs):
        c['name'] = climb_names[k] if k < len(climb_names) else f'Anstieg {k + 1}'
    route = {'id': rid, 'name': name, 'desc': desc, 'x': [round(float(v), 1) for v in Q[:, 0]], 'z': [round(float(v), 1) for v in Q[:, 1]],
             'h': [round(float(v), 1) for v in h], 'segs': merged, 'climbs': climbs, 'len': round(L), 'gain': round(gain)}
    print(f'{name}: {L / 1000:.1f} km, {gain:.0f} Hm, {len(merged)} Abschnitte, Anstiege: ' +
          ', '.join(f"{c['name']} {c['len'] / 1000:.1f} km/{c['gain']:.0f} Hm/Ø {c['avg']} %/max {c['max']:.0f} %" for c in climbs))
    return route


# ---------------- neue Routen (Wegpunkte: lat, lon) ----------------
START = (48.39723, 9.99356)        # Neue Straße am Münsterplatz, wie die übrigen Ulm-Runden
NEW_ROUTES = [
    dict(id='elchingen', name='Donau & Kloster Elchingen',
         desc='Auf dem Donauradweg nach Thalfingen, hinauf zum Kloster Oberelchingen und über Pfuhl und Neu-Ulm zurück.',
         wps=[START, (48.4068, 10.0175), (48.4250, 10.0293), (48.4378, 10.0509), (48.45235, 10.08806), (48.4136, 10.0693),
              (48.4104, 10.0403), (48.4010, 10.0150), (48.3955, 10.0005)],
         climbs=['Klosterberg Elchingen']),
    dict(id='iller', name='Iller & Kloster Wiblingen',
         desc='Durch Neu-Ulm an die Iller, auf dem Iller-Radweg bis Kirchberg und am Kloster Wiblingen vorbei zurück.',
         wps=[START, (48.3930, 10.0030), (48.3678, 10.0118), (48.3234, 10.0204), (48.3394, 10.0006), (48.3617, 9.9912), (48.3830, 9.9700)],
         climbs=[]),
    dict(id='blau', name='Blautal & Hochsträß',
         desc='Durch Söflingen ins Blautal bis Arnegg, steil hinauf nach Ermingen, über die Hochfläche und am Kuhberg zurück.',
         wps=[START, (48.3958, 9.9546), (48.4176, 9.9210), (48.4183, 9.9068), (48.3826, 9.8985), (48.3638, 9.8810), (48.3730, 9.9359), (48.3850, 9.9680)],
         climbs=['Erminger Steige', 'Allewind']),
]
# Ortschaften entlang der neuen Routen → Bebauungszonen in der App (Typ, Radius x/z in m, Dichte)
ZONE_TYPES = {'town': ('sub', 650, 0.65), 'village': ('sub', 380, 0.6), 'suburb': ('sub', 500, 0.6), 'hamlet': ('sub', 140, 0.45)}
LANDMARKS = {'wiblingen': (48.36166, 9.99119), 'elchingen': (48.45235, 10.08806)}


def make_grid(dem, osm, step=85.0):
    bb = osm.bbox
    x0, z0 = ll2xz(bb['n'] - 0.004, bb['w'] + 0.006)
    x1, z1 = ll2xz(bb['s'] + 0.004, bb['e'] - 0.006)
    nx, nz = int((x1 - x0) / step) + 1, int((z1 - z0) / step) + 1
    H = [[round(dem.h(x0 + i * step, z0 + j * step), 1) for i in range(nx)] for j in range(nz)]
    return {'x0': round(x0, 1), 'dx': step, 'z0': round(z0, 1), 'dz': step, 'nx': nx, 'nz': nz, 'h': H}


def near_route(routes, x, z, r):
    for rt in routes:
        X, Z = np.array(rt['x'][::10]), np.array(rt['z'][::10])
        if np.min(np.hypot(X - x, Z - z)) < r:
            return True
    return False


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    osm = Osm(sys.argv[1])
    bb = osm.bbox
    print('Höhenkacheln …')
    dem = Dem(bb['s'] - 0.01, bb['w'] - 0.02, bb['n'] + 0.01, bb['e'] + 0.02)
    print('Flüsse …')
    rivers = build_rivers(osm, dem)
    print('Wegenetz …')
    G = Graph(osm)
    routes = [build_route(G, dem, r['wps'], r['id'], r['name'], r['desc'], r['climbs']) for r in NEW_ROUTES]
    print('Höhenraster …')
    grid = make_grid(dem, osm)
    zones = []
    for typ, name, la, lo in osm.d['places']:
        if typ in ZONE_TYPES:
            x, z = ll2xz(la / 1e5, lo / 1e5)
            if math.hypot(x, z) > 2600 and near_route(routes, x, z, 1500):
                t, r, dn = ZONE_TYPES[typ]
                zones.append([t, round(lo / 1e5, 5), round(la / 1e5, 5), r, r * 0.8, dn, name])
    # bestehende Daten laden, ergänzen, schreiben
    src = open(DATA, encoding='utf-8').read()
    head, js = src.split('const ULM_DATA=', 1)
    U = json.loads(js.strip().rstrip(';'))
    U['grid'] = grid
    U.pop('river', None)
    U['rivers'] = rivers
    U['zones'] = zones
    for k, (la, lo) in LANDMARKS.items():
        U['places'][k] = [round(v, 1) for v in ll2xz(la, lo)]
    old = [r for r in U['routes'] if r['id'] not in {n['id'] for n in routes}]
    U['routes'] = old + routes
    head = ('/* Ulm-Daten: Höhen EU-DEM (Copernicus; über OpenTopoData bzw. AWS Terrain Tiles), Straßen, Radwege und '
            'Gewässer © OpenStreetMap-Mitwirkende (ODbL). Erzeugt mit tools/ulm_routen.py */\n')
    with open(DATA, 'w', encoding='utf-8') as f:
        f.write(head + 'const ULM_DATA=' + json.dumps(U, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{DATA}: {os.path.getsize(DATA) // 1024} KB, {len(U["routes"])} Routen, {len(zones)} Ortszonen, '
          f'Raster {grid["nx"]}×{grid["nz"]}')
    write_house_query()



def dp(P, tol):
    """Douglas-Peucker (Linie vereinfachen)."""
    if len(P) < 3:
        return P
    a, b = np.array(P[0]), np.array(P[-1])
    d = b - a
    l = np.hypot(*d) or 1
    dist = [abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / l for p in P[1:-1]]
    i = int(np.argmax(dist)) + 1
    if dist[i - 1] > tol:
        return dp(P[:i + 1], tol)[:-1] + dp(P[i:], tol)
    return [P[0], P[-1]]


def write_house_query(C=1200, R=220, CORE=650):
    """tools/ulm-haeuser-holen.html: Kartenstücke (C m) entlang aller Routen und die Routenlinien eintragen.
    Die Seite fragt die Stücke nacheinander ab und behält nur Häuser im Umkreis von R m (bzw. CORE m ums Münster)."""
    U = json.loads(open(DATA, encoding='utf-8').read().split('const ULM_DATA=', 1)[1].strip().rstrip(';'))
    cells, lines = set(), []
    for r in U['routes']:
        P = list(zip(r['x'], r['z']))
        P.append(P[0])
        for (ax, az), (bx, bz) in zip(P, P[1:]):
            n = max(1, int(math.hypot(bx - ax, bz - az) / 40))
            for k in range(n + 1):
                x, z = ax + (bx - ax) * k / n, az + (bz - az) * k / n
                for i in range(math.floor((x - R - 20) / C), math.floor((x + R + 20) / C) + 1):
                    for j in range(math.floor((z - R - 20) / C), math.floor((z + R + 20) / C) + 1):
                        cells.add((i, j))
        h = len(P) // 2
        S = dp(P[:h + 1], 6)[:-1] + dp(P[h:], 6)
        lines.append([v for x, z in S for v in (round(x), round(z))])
    for i in range(math.floor(-CORE / C), math.floor(CORE / C) + 1):
        for j in range(math.floor(-CORE / C), math.floor(CORE / C) + 1):
            cells.add((i, j))
    bb = []
    for i, j in sorted(cells, key=lambda c: (c[1], c[0])):
        n, w = xz2ll(i * C, j * C)
        s, e = xz2ll((i + 1) * C, (j + 1) * C)
        bb.append([round(s, 5), round(w, 5), round(n, 5), round(e, 5)])
    d = json.dumps({'cells': bb, 'routes': lines, 'r': R, 'core': CORE}, separators=(',', ':'))
    p = os.path.join(ROOT, 'tools', 'ulm-haeuser-holen.html')
    s = open(p, encoding='utf-8').read()
    s, k = re.subn(r'^const D=.*;$', lambda m: 'const D=' + d + ';', s, count=1, flags=re.M)
    assert k == 1, 'Platzhalter „const D=…;“ fehlt in ulm-haeuser-holen.html'
    open(p, 'w', encoding='utf-8').write(s)
    print(f'{p}: {len(bb)} Kartenstücke, {len(lines)} Routen ({len(d) // 1024} KB)')


if __name__ == '__main__':
    main()
