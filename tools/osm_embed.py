#!/usr/bin/env python3
"""Wandelt eine Overpass-Antwort (ulm-haeuser.json, siehe tools/ulm-haeuser-holen.html) in die
kompakte Gebäude-Datei src/data/osm-buildings.js um.

Format OSM_RAW: {v, ts, t:[Gebäudearten], r:[Dachformen], b:[[deltas, art, höhe, etagen, dach, dachfarbe, wandfarbe], …]}
Grundriss in lokalen Metern (direkt aus lat/lon) (Ursprung = ULM_DATA.origin) auf 0,2-m-Raster, erster Punkt absolut, danach Deltas.
Nachgestellte leere Werte werden weggelassen.

Aufruf:  python3 tools/osm_embed.py ulm-haeuser.json [src/data/osm-buildings.js] [--routes=src/data/ulm-data.js]
         (--routes: Routen-Stand, für den ulm-haeuser.json geholt wurde → Abdeckung „cov“)
"""
import json, math, sys, datetime

ORIGIN = (48.3985, 9.9925)          # muss zu ULM_DATA.origin passen
KX = 111320 * math.cos(math.radians(ORIGIN[0]))

def js_round(x):                    # wie Math.round in JavaScript
    return math.floor(x + 0.5)

def ll(lon, lat):
    return (lon - ORIGIN[1]) * KX, -(lat - ORIGIN[0]) * 110540

def num(v):                         # wie parseFloat: „12 m“ → 12.0, leer → 0
    import re
    m = re.match(r'\s*([+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)', str(v or ''))
    return float(m.group(1)) if m else 0

def slim(js):
    out = []
    def add(geom, t):
        if not geom or len(geom) < 4:
            return
        pts = []
        for g in geom:
            x, z = ll(g['lon'], g['lat'])
            pts.append((x, z))
        out.append(dict(p=pts, h=num(t.get('height')), l=num(t.get('building:levels')),
                        rs=t.get('roof:shape', ''), b=t.get('building', 'yes'),
                        rc=t.get('roof:colour', ''), bc=t.get('building:colour', '')))
    for el in js.get('elements', []):
        if el.get('type') == 'way':
            add(el.get('geometry'), el.get('tags', {}))
        elif el.get('type') == 'relation':
            for m in el.get('members', []):
                if m.get('role') == 'outer' and m.get('geometry'):
                    add(m['geometry'], el.get('tags', {}))
    return out

def encode(buildings, ts):
    types, roofs, rows = [], [''], []
    def idx(lst, v):
        if v not in lst:
            lst.append(v)
        return lst.index(v)
    for b in buildings:
        pts = b['p'][:-1] if len(b['p']) > 1 and b['p'][0] == b['p'][-1] else b['p']  # Ring: Schlusspunkt weg
        q = []
        for x, z in pts:                # doppelte Punkte (nach dem Runden) weglassen
            c = (js_round(x * 5), js_round(z * 5))
            if not q or q[-1] != c:
                q.append(c)
        f = [q[0][0], q[0][1]]
        for (ax, az), (bx, bz) in zip(q, q[1:]):
            f += [bx - ax, bz - az]
        row = [f, idx(types, b['b']), b['h'], b['l'], idx(roofs, b['rs']), b['rc'], b['bc']]
        while len(row) > 2 and not row[-1]:
            row.pop()
        rows.append(row)
    return {'v': 1, 'ts': ts, 't': types, 'r': roofs, 'b': rows}

def coverage(data_js, r=200.0, core=(48.3986, 9.9925, 630.0), cell=50):
    """Wo die Häuser-Abfrage gesucht hat (Umkreis r um alle Routen, Kreis ums Münster): 50-m-Raster, lauflängenkodiert.
    Nur dort ersetzt die App ausgedachte Häuser durch echte – woanders bleibt die ausgedachte Bebauung."""
    U = json.loads(open(data_js, encoding='utf-8').read().split('const ULM_DATA=', 1)[1].strip().rstrip(';'))
    pts = [(x, z) for rt in U['routes'] for x, z in zip(rt['x'], rt['z'])]
    cx, cz = ll(core[1], core[0])
    pts_all = pts + [(cx, cz)]
    x0 = math.floor((min(p[0] for p in pts_all) - core[2]) / cell) * cell
    z0 = math.floor((min(p[1] for p in pts_all) - core[2]) / cell) * cell
    x1 = max(p[0] for p in pts_all) + core[2]
    z1 = max(p[1] for p in pts_all) + core[2]
    nx, nz = int((x1 - x0) / cell) + 1, int((z1 - z0) / cell) + 1
    on = bytearray(nx * nz)
    k = int(math.ceil(r / cell))
    for x, z in pts:
        i0, j0 = int((x - x0) / cell), int((z - z0) / cell)
        for i in range(max(0, i0 - k), min(nx, i0 + k + 1)):
            for j in range(max(0, j0 - k), min(nz, j0 + k + 1)):
                if math.hypot(x0 + (i + 0.5) * cell - x, z0 + (j + 0.5) * cell - z) < r:
                    on[j * nx + i] = 1
    for i in range(nx):
        for j in range(nz):
            if math.hypot(x0 + (i + 0.5) * cell - cx, z0 + (j + 0.5) * cell - cz) < core[2]:
                on[j * nx + i] = 1
    runs, cur, n = [], 0, 0
    for v in on:
        if v != cur:
            runs.append(n); cur, n = v, 0
        n += 1
    runs.append(n)
    return {'x0': x0, 'z0': z0, 'c': cell, 'nx': nx, 'nz': nz, 'runs': runs}

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--routes=')]
    routes = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--routes=')), 'src/data/ulm-data.js')
    src = args[0]
    dst = args[1] if len(args) > 1 else 'src/data/osm-buildings.js'
    raw = json.load(open(src, encoding='utf-8'))
    ts = (raw.get('osm3s', {}).get('timestamp_osm_base')
          or datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'))
    enc = encode(slim(raw), ts)
    enc['cov'] = coverage(routes)
    with open(dst, 'w', encoding='utf-8') as fh:
        fh.write('/* Echte Ulmer Gebäude entlang aller Routen: © OpenStreetMap-Mitwirkende, ODbL – '
                 'kompakt (0,2-m-Raster, Deltas). Erzeugt mit tools/osm_embed.py */\n')
        fh.write('const OSM_RAW=' + json.dumps(enc, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(len(enc['b']), 'Gebäude →', dst)
