# Kalea Ride – Hinweise für Claude

Indoor-Radfahr-App im Browser. Ein Smart-Trainer (FTMS, z. B. Wahoo KICKR Core) und ein
Zwift Click v2 werden per **Web Bluetooth** verbunden. Zwei Welten: **Kalea** (Vulkaninsel, erfunden) und
**Ulm** (echte Straßen, Höhen und Gebäude). Alles läuft clientseitig, kein Server, kein Framework, kein Bundler.

## Mit wem du arbeitest
- Felix, Lehrer aus Baden-Württemberg, Rennradfahrer (ca. 70 kg; KICKR Core, Zwift Click v2, Garmin Edge 540
  mit Powermeter). **Antworte auf Deutsch.** Er ist kein Profi-Entwickler: Ergebnisse kurz und verständlich
  erklären, keine langen Code-Rundgänge.
- Er testet am PC (Chrome/Edge) und auf dem iPad mit der App **Bluefy** (Safari kann kein Web Bluetooth).

## Aufbau
```
src/index.html            Markup + CSS (Comic-Look, Schrift Fredoka) + <script>-Einbindungen
src/app.js                das ganze Programm (~2400 Zeilen, in Abschnitte gegliedert, s. u.)
src/data/ulm-data.js      const ULM_DATA = {origin, grid (EU-DEM-Höhen), roads, river, places, routes[5]}
src/data/osm-buildings.js const OSM_RAW  = 9336 echte Ulmer Gebäude (OSM, ODbL), kompakt kodiert
src/data/sounds.js        const SOUNDS = Fahrgeräusche als data:-URLs (aus tools/sounds_build.py)
tools/build.py            baut dist/kalea-ride.html, dist/kalea-ride-offline.html, dist/artifact.html
tools/osm_embed.py        Overpass-JSON (ulm-haeuser.json) → src/data/osm-buildings.js
tools/ulm-haeuser-holen.html  Hilfsseite: lädt die Häuser im Browser über Overpass und speichert ulm-haeuser.json
tools/analyse/            FIT-Dateien auswerten (Physik-Abgleich echt ↔ Zwift ↔ App)
```
- **Quelle der Wahrheit ist `src/`.** `dist/` wird nur gebaut (gitignored). Die Datendateien sind riesige
  Einzeiler – nie komplett lesen oder von Hand bearbeiten, nur per Skript erzeugen.
- Entwickeln ohne Build: `src/index.html` direkt im Browser öffnen (file:// geht) oder `npm run serve`.
- Bauen: `npm install` (nur für die Offline-Fassung: three@0.128.0, mqtt@4.3.7, @fontsource/fredoka) und
  `python3 tools/build.py`. Die gebaute Einzeldatei ist das, was Felix aufs iPad/den PC bekommt.

### Abschnitte in `src/app.js` (Suche nach `/* ===`)
Einstellungen & Zustand (`S`, `PHYS`, `FEELS`, `loadSettings`/`saveSettings`) · Gelände · Strecke
(`buildRoute`, `roadAt`, `gradeAt`, `buildCurves`/`curveLimit`) · Three.js-Grundgerüst · WELT ULM
(`buildRouteUlm`, `buildCityUlm`, Wahrzeichen wie `buildMuenster`, `buildKornhaus` …) · Fahrer-Modelle ·
**Physik** (`advance`, `stepPhysics`, `trainerGradeCmd`, `SHIFT_FEEL`, `trainerRatio`) · ERG & Workouts ·
Bergwertung (`KOM`, `stepKom`) · Fahrt-Statistik (`REC`, `rideSummary`, `showStats`, `exportTcx`) ·
Online (`NET`, MQTT über öffentliche WSS-Broker) · Bluetooth (FTMS, Zwift Click) · Schalten · HUD ·
Comic-Look (`toonify`, Konturen-Postprocessing) · Karte (`drawMap`) · OSM-Häuser (`buildOsmBuildings`) ·
Kamera & Loop · UI-Verdrahtung (`wireUi`) · Start.

## Wichtige Fachlogik
- **Physik:** `F = m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v² + 1,2 N`. Fahrgefühl `S.feel`:
  `real` (Standard; Crr 0,005, CdA 0,32, +2 kg, ρ nach Höhe, Kurvenbremsen mit 4,2 m/s² Querbeschleunigung,
  bergab max. ~58 km/h), `std` (Crr 0,004, CdA 0,32), `light` „Leichtlauf“ (CdA 0,27). Abgestimmt auf Felix' echte
  Edge-540-Fahrten: flach passt die App genau, Zwift ist 4–10 % schneller, echte Abfahrten 45–53 km/h im Rollen.
- **Virtuelles Schalten:** Trainer bekommt eine Simulations-Steigung (FTMS 0x11), die aus Straßenkraft ×
  `curRatio()/trainerRatio()` berechnet wird. Der echte Gang am Trainer wird **einmal** gemessen
  (`measureTrainerGear`, KICKR rechnet mit 2096 mm), auf ganze Zähne gerundet (`snapGear`) und dann fest gespeichert
  (`S.trMeas`/`S.trGear`, „Neu messen“ im Menü). Vorgabe Trainer-Gang **34 × 14** (festes Trainer-Ritzel mit
  14 Zähnen, Felix fährt vorne meist 34); alte Einstellungen mit 50 × 17 werden einmalig umgestellt (`sv`). Nach dem Hochschalten 1,8 s weiches Nachziehen (`S.upT`), beim
  Anfahren aus dem Stand weiches Nachziehen bis Rad und Avatar gleich schnell sind (`T.startSoft`).
- **Normale Kassette** (`S.vshift=false`, Auswahl „Schalten“ bei den Geräten): echte Steigung an den Trainer, keine
  virtuellen Gänge; der aufgelegte Gang wird nur angezeigt (`updateRealGear`).
- **Geräte-Fenster** beim Start (`openDevices`/`closeDevices` verschieben `#devSec` zwischen Fenster und Menü).
- **Welt-/Routenwechsel ohne Neuladen** (`rebuildWorld` → `clearWorld` + `buildWorld`), damit Bluetooth verbunden
  bleibt. Wer neue globale Welt-Arrays/Caches anlegt, muss sie in `clearWorld` zurücksetzen.
- **Töne** (`SND`, `sndStep`, `sndShift`): Schalt-/Ketten-/Freilaufgeräusche aus Felix' Aufnahmen in
  `src/data/sounds.js` (erzeugt mit `tools/sounds_build.py`; die Original-Aufnahmen enthalten Sprache und kommen
  nicht ins Repo). Umgebung (Wind, Vögel, Wasser, Stadt), Abrollen, Pflaster-Rattern (Ulmer Altstadt),
  Reifen-„Wusch“ bei kräftigen Tritten und beim Vorbeifahren (Leitpfosten, Laternen, Fahrer) per Web Audio erzeugt.
- **Tempo-Gefühl im Bild:** Sichtfeld weitet sich (`updateCamera`), Kamera rubbelt leicht, Comic-Speed-Linien ab
  ca. 32 km/h im Konturen-Shader (`speedLines`, nur mit Comic-Konturen). Lautstärken `S.sndBike`,
  `S.sndAmb`, `S.mute`; Ton startet erst nach einer Berührung/Taste.
- **Mitfahrer** (`BOTS`, `stepBots`, `S.botMode`): Rollen „Gruppe“ (richtet sich nach `S.p30` = ~30-s-Mittel deiner
  Leistung, bleibt per Gummiband in deiner Nähe, wartet beim Start), „langsam“ (wirst überholt), „schnell“ (überholt
  dich); weit Entfernte werden außer Sicht neu eingesetzt. Modi `me` / `solo` (ohne Gruppe, nur langsame und schnelle Fahrer) / `fixed` (`S.botWkg`) / `off`. Gegenverkehr
  `ONC` auf der linken Straßenhälfte. Statische Körperteile jedes Fahrers sind in `makeRider` zu einem Mesh
  zusammengefasst (Zeichenaufrufe sparen).
- **Leben am Rand** (`LIFE`, `buildLife`, `stepLife`, Schalter `S.life`): Fußgänger/Jogger mit Hunden als Pool rund um
  dich (`stepWalkers`, drehen vor Wasser/Häusern um), Menschen auf Plätzen/Strand, Kühe, Pferde, Störche, Enten und
  Schwäne, Ausflugsboote auf der Donau, parkende Autos, Möwen und Delfine auf Kalea. Alles InstancedMesh;
  `freeSpot`/`inOsm`/`nearOsm` verhindern Figuren in Häusern, auf der Strecke oder im Wasser.
- **Online-Gummiband** (`netRubber`, `NET.rf`, Raum-Flag `NET.info.rubber`, nur Gruppenfahrt): jeder Client rechnet den
  Abstand zur Gruppenmitte und bewegt sich mit `S.dist+=S.v·NET.rf·dt` (0,6…1,6) – Watt/Widerstand bleiben echt.
  Gesendet wird die effektive Geschwindigkeit. Stehende (<0,8 m/s) oder >1,5 km entfernte Mitfahrer zählen nicht.
  Bergwertung/Runde mit Gummiband (`a.rb`) zählt nicht als Bestzeit.
- **Runde geschafft:** `stepLap`/`finishLap` zeigen nach jeder vollen Runde ein Banner wie die Bergwertung.
- **Zwift Click v2:** Protokoll 0x23 (Tasten-Bitmaske), 0x37, 0x19 (Batterie), 0x15 (Leerlauf). Halten =
  Dauerschalten (`HOLD.pad`, Abbruch nach 4 s).
- **Ulm-Koordinaten:** lokale Meter, Ursprung `ULM_DATA.origin` (48.3985, 9.9925), x = Ost, z = Süd,
  `ulmLL(lon,lat)`. Höhe y = Meter über NN − `UY0` (460).
- **Speicher:** `localStorage` (`kalea` = Einstellungen, `kalea_world`, `kalea_route_<welt>`, `kalea_kom`,
  `kalea_rides`, `kalea_laps`, `kalea_map`, `kalea_net*`, `kalea_broker`), Gebäude-Cache in IndexedDB `kaleaRide`.
- **Leistung:** iPad/Handy laufen auf Qualität `low`. Neue Objekte als `InstancedMesh` bzw. über `mergeGroup`
  in CHUNK-Kacheln, Schatten werden nur jedes 2. Bild neu berechnet – das so beibehalten, Felix' PC wurde
  sonst heiß.

## Konventionen
- **Keine Zwift-Namen** in App, Texten und Code (Markenrecht). Neutral: „Click-Schalter“, „Leichtlauf“,
  „Standard (24 Gänge)“. Erlaubt sind nur der Bluetooth-Namensfilter und ein Kompatibilitätshinweis beim Gerät.
- **Farben:** Violett `#490cb8`, Lila `#9d20a3`, Pink `#eb567b` (Akzent), Gelb `#f8d74e`, Tinte `#1e0f3a`.
- UI-Texte und Kommentare auf Deutsch, kurz, mit Emojis sparsam wie bisher.
- three.js bleibt auf **r128** (CDN cdnjs). Keine weiteren Abhängigkeiten ohne Not; alles muss sich für die
  Offline-Fassung einbetten lassen.
- Tastatur: ↑/+ hoch, ↓/− runter, C Kamera, M Karte, I Statistik, E ERG, F Vollbild, T Ton, W/S Testleistung, Esc Menü.
- **Handy-Layout:** eigene CSS-Blöcke am Ende von `index.html` für Hochformat (`max-width:520px`) und Querformat
  (`max-height:500px`). Neue HUD-Elemente dort mit anpassen. Vollbild über `toggleFullscreen` (iPhone kann es nicht).
- Attribution erhalten: Karten-/Gebäudedaten © OpenStreetMap-Mitwirkende (ODbL), Höhen EU-DEM (Copernicus).
- **Persönliche Fahrdateien (.fit/.tcx) nie einchecken** – sie enthalten GPS-Spuren (s. `.gitignore`).

## Testen
- Ohne Trainer: im Menü „Ohne Trainer testen“ (`S.sim`), Leistung mit W/S.
- Automatisiert: Playwright + Chromium (`--use-angle=swiftshader --enable-unsafe-swiftshader`). In der
  Cloud-Umgebung ist das CDN oft gesperrt → entweder `dist/kalea-ride-offline.html` testen oder
  `page.route('https://cdnjs.cloudflare.com/**', …)` auf `node_modules/three/build/three.min.js` umleiten.
  Physik lässt sich ohne Grafik prüfen: `S.sim=true; S.simPower=180;` und `stepPhysics(0.25)` in einer Schleife.
- Vor dem Abgeben: `python3 tools/build.py` muss ohne Fehler durchlaufen.

## Veröffentlichen
- Jeder Push auf `main` baut die App per GitHub Actions (`.github/workflows/pages.yml`) und stellt sie auf
  https://6s2tkg87cn-ux.github.io/kalea-ride/ (Startseite = Offline-Fassung). Das Repository ist öffentlich.
- Commits mit der anonymen Adresse `343975191+6s2tkg87cn-ux@users.noreply.github.com` als Autor, nie mit Felix'
  privater E-Mail-Adresse.
