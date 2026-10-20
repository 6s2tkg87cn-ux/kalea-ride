#!/usr/bin/env python3
"""Wandelt eine Overpass-Antwort (ulm-haeuser.json, siehe tools/ulm-haeuser-holen.html) in die
kompakte Gebäude-Datei src/data/osm-buildings.js um.

Format OSM_RAW: {v, ts, t:[Gebäudearten], r:[Dachformen], b:[[deltas, art, höhe, etagen, dach, dachfarbe, wandfarbe], …]}
Grundriss in lokalen Metern (direkt aus lat/lon) (Ursprung = ULM_DATA.origin) auf 0,2-m-Raster, erster Punkt absolut, danach Deltas.
Nachgestellte leere Werte werden weggelassen.

Aufruf:  python3 tools/osm_embed.py ulm-haeuser.json [src/data/osm-buildings.js]
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

if __name__ == '__main__':
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else 'src/data/osm-buildings.js'
    raw = json.load(open(src, encoding='utf-8'))
    ts = (raw.get('osm3s', {}).get('timestamp_osm_base')
          or datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'))
    enc = encode(slim(raw), ts)
    with open(dst, 'w', encoding='utf-8') as fh:
        fh.write('/* Echte Ulmer Gebäude entlang aller Routen: © OpenStreetMap-Mitwirkende, ODbL – '
                 'kompakt (0,2-m-Raster, Deltas). Erzeugt mit tools/osm_embed.py */\n')
        fh.write('const OSM_RAW=' + json.dumps(enc, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(len(enc['b']), 'Gebäude →', dst)
