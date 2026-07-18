# Changelog

All notable changes to VocalDNA are recorded here.

## [1.0.0] — Version 1 (PWA rebuild)

### Platform change

- **Discarded the Electron desktop build entirely.** VocalDNA is now a
  local-first Progressive Web App (React + TypeScript + Vite), so it can be
  installed and used directly on an iPad via Safari's "Add to Home Screen" —
  no desktop required.
- Replaced `better-sqlite3` (Node-only) with **Dexie** as a typed wrapper
  around **IndexedDB**, the browser's built-in local database. All data
  still lives only on-device; nothing is sent anywhere.
- Replaced `adm-zip` (Node `fs`-based) with **JSZip** for reading the
  `.st4b` archive entirely in-browser from a user-selected `File` object.
  Browser `File` objects have no write API, so the original file cannot be
  modified by this app even in principle.
- Added `vite-plugin-pwa` for an offline-capable service worker, web app
  manifest, and iOS home-screen icons.

### Added — Version 1 feature set

1. **Import StageTraxx4 `.st4b`** — reads the archive client-side, parses
   `backup_data.json`, never writes back to the source file.
2. **Internal IndexedDB database** — VocalDNA's own schema (`songs`,
   `artists`, `folders`, `tracks`, `ratings`, `externalIds`, `importLog`,
   plus reserved tables for future features), independent of StageTraxx's
   internal structure.
3. **Song browser** — grid view of every imported song with key, BPM,
   artist, folder, and rating status at a glance.
4. **Instant search** — client-side title/artist search with no perceptible
   delay.
5. **Filters** — by folder, artist, key, and rating status, combinable with
   search.
6. **Song detail page** — key, BPM, duration, track list, full lyrics/chart,
   and the rating form, reached with an iPad-style back button.
7. **Rating system** — Difficulty, Confidence, Enjoyment, Fatigue (1–5
   scales), Transpose (±12 semitones), Status (new / learning / ready /
   performance-ready / retired), and free-text Notes. Stored per song in the
   `ratings` table.
8. **Statistics dashboard** — song/artist/folder counts, average BPM, key
   distribution, rating coverage, average rating dimensions, status
   breakdown, top artists. Computed by a UI-independent analytics module.
9. **Voice Profile dashboard** — strongest and most challenging keys (by
   confidence/difficulty), transpose patterns, a four-quadrant repertoire
   map (Strongest / Comfort zone / Growing / Needs work), and a recent
   fatigue trend — all derived honestly from the singer's own recorded
   ratings, with no fabricated audio/acoustic analysis.

### Carried over from the original design

- **Permanent internal UUIDs** for every imported entity (songs, artists,
  folders, tracks) — StageTraxx IDs are never used as primary keys.
- **`externalIds` mapping table** so repeat imports (from StageTraxx now,
  and potentially other sources like OnSong/MusicXML/ChordPro later) update
  existing rows instead of creating duplicates.
- **Analytics fully decoupled from the UI** (`src/analytics/`), so the
  Statistics and Voice Profile dashboards are pure renderers of data
  computed elsewhere.
- **Modular architecture**: `db/`, `import/`, `analytics/`, `types/`, and
  one folder per feature under `features/`.

### Removed

- Electron main/preload/renderer processes and IPC bridge (superseded by
  running directly in the browser).
- `better-sqlite3` and `adm-zip` Node dependencies (superseded by Dexie and
  JSZip, both browser-compatible).
