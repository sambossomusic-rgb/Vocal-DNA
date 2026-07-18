# Changelog

All notable changes to VocalDNA are recorded here.

## [2.0.0] — Version 2 (speed & assessment)

Built per the VocalDNA Constitution: every change targets the mission of
reducing manual rating effort, without redesigning Version 1's architecture,
rewriting working code, or changing the database beyond what each feature
needed. All Version 1 data, screens, and behavior are unchanged and still
work exactly as before.

### Added

1. **Quick Assessment mode** (new default tab) — a one-question,
   one-tap-per-song flow ("How often do you currently perform this song?":
   🎤 Regular / 🎵 Occasional / 📚 Learning / 🚫 Never) that auto-advances
   through every unassessed song in the library.
2. **Smart follow-up** — only songs marked Regular or Occasional get a
   second, minimal screen: Demand (1-10), Reliability (1-10), Transpose,
   Notes, one Save & Next button.
3. **Adaptive defaults + statistical prediction engine** — a new,
   UI-independent `analytics/predictionEngine.ts` learns per-tag averages
   (demand, reliability, frequency) and per-key transpose averages from the
   performer's own prior ratings, and the follow-up screen prefills from it
   (with the sample size shown) so agreeing is a single tap. No AI/ML —
   pure statistics over the performer's own data.
4. **Progress dashboard** (`analytics/progressEngine.ts`) — songs imported,
   assessed, remaining, prediction confidence, and most common status,
   shown at the top of the Assess tab.
5. **Batch actions** — mark every song in the Library's current
   search/folder/artist/tag view as Regular/Occasional/Learning/Never, or
   apply a transpose or note to all of them at once.
6. **Free-form tag system** — user-created tags (never hardcoded), editable
   per song from the Song Detail page, built on the `keywords`/
   `songKeywords` tables reserved for exactly this in Version 1.
7. **Tag filtering** — the Library's filter panel now supports selecting
   multiple tags (a song must carry all selected tags), alongside the
   existing folder/artist/key/status filters.
8. **Schema prepared for future features** (not built yet, per the
   Constitution) — reserved optional fields for audience rating, guitar/solo
   difficulty, capo, alternate tuning, and performance notes, plus a
   reserved `performanceHistory` table for future per-gig logging.

### Database

- Dexie bumped to version 2, adding only the reserved `performanceHistory`
  table — every Version 1 table and index is unchanged.
- `Rating` gained optional `performanceFrequency`, `demand`, `reliability`
  fields (Version 1 rows work unchanged since they're optional) plus
  reserved fields for future features.
- `Song` gained reserved optional `capo`/`alternateTuning` fields.

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
