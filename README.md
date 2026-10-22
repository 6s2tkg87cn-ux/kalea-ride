# Kalea Ride 🚴

Eine Indoor-Radfahr-App, die komplett im Browser läuft – mit Smart-Trainer und Click-Schalter.

- **Zwei Welten:** Kalea (Vulkaninsel) und Ulm mit echten Straßen, Höhen und rund 9 300 echten Häusern
- **Routen:** flach, mit einem Berg oder die große Runde – in Ulm z. B. Michelsberg, Eselsberg, Kuhberg
- **Trainer:** FTMS über Bluetooth (z. B. Wahoo KICKR Core), Simulations- und ERG-Modus
- **Virtuelles Schalten** mit Click-Schalter (kompatibel mit Zwift Click v2) oder **normale Kassette**, Schaltgefühl und Trainer-Gang werden automatisch abgestimmt
- **Fahrgefühl:** Realistisch (auf echte Fahrten abgestimmt), Standard oder Leichtlauf
- **Bergwertung** mit Bestzeiten, **Statistiken** mit Diagrammen und TCX-Export, **Minikarte**
- **Online-Rennen** gegen Freunde (Raum-Code, ohne eigenen Server)
- Comic-Look, läuft auch auf dem iPad

## Benutzen
**Direkt im Browser:** https://6s2tkg87cn-ux.github.io/kalea-ride/ – wird bei jeder Änderung automatisch neu gebaut.

1. Die App bauen (siehe unten) und `dist/kalea-ride.html` – oder `dist/kalea-ride-offline.html` für ganz ohne
   Internet – in **Chrome oder Edge** öffnen. Zum schnellen Ausprobieren geht auch `src/index.html` direkt.
   Auf dem **iPad** die App **Bluefy** nehmen – Safari kann kein Bluetooth.
2. Im Geräte-Fenster Trainer und Click-Schalter verbinden, Welt und Route wählen, losfahren.
3. Ohne Trainer: **„Ohne Trainer testen“** – Leistung mit den Tasten W/S.

Tasten: ↑/↓ schalten · C Kamera · M Karte · I Statistik · E ERG · F Vollbild · T Ton · Esc Menü

## Selbst bauen
```bash
npm install            # nur für die Offline-Fassung nötig
python3 tools/build.py # erzeugt dist/kalea-ride.html, dist/kalea-ride-offline.html, dist/artifact.html
```
Zum Entwickeln reicht es, `src/index.html` direkt im Browser zu öffnen.

**Häuser aktualisieren:** `tools/ulm-haeuser-holen.html` im Browser öffnen → `ulm-haeuser.json` speichern →
`python3 tools/osm_embed.py ulm-haeuser.json`.

**Neue Ulm-Routen:** `tools/ulm-routen-holen.html` im Browser öffnen → `ulm-routen.json` (Wege, Radrouten, Flüsse, Wasserflächen) speichern; Höhen kommen aus den Terrarium-Höhenkacheln (AWS).

## Daten & Lizenzen
- Straßen und Gebäude © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, ODbL
- Höhen: EU-DEM (Copernicus), abgefragt über OpenTopoData
- [three.js](https://threejs.org) r128 (MIT), [MQTT.js](https://github.com/mqttjs/MQTT.js) (MIT),
  Schrift [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL OFL)
