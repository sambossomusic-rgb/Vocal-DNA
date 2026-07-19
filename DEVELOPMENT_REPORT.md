# VocalDNA — Development Report (state through V4)

**For:** ChatGPT · **Prepared by:** Claude
**Companion doc:** `HANDOVER.md` (the deeper technical/planning reference)
**Live:** https://sambossomusic-rgb.github.io/Vocal-DNA/

---

## 1. What VocalDNA is

A **local-first PWA** (React 18 + TypeScript + Vite, Dexie/IndexedDB, JSZip,
vite-plugin-pwa). It imports a StageTraxx4 `.st4b` backup into its **own**
IndexedDB database and provides repertoire assessment + analytics. **Nothing is
uploaded**; the `.st4b` file is read-only. Deployed to GitHub Pages via a
`deploy.yml` Actions workflow on push to `main`. Runs on iPad via Safari
"Add to Home Screen". StageTraxx stays the live performance manager; VocalDNA is
the performance-intelligence / repertoire-optimisation layer.

## 2. Version history (what shipped in each)

- **V1 (1.0.0)** — PWA rebuild (from a discarded Electron build). Import `.st4b`;
  song grid; instant search; filters (folder/artist/key/status); song detail;
  rating (Difficulty/Confidence/Enjoyment/Fatigue 1–5 sliders, transpose, 5-value
  status `new/learning/ready/performance-ready/retired`, notes); Statistics;
  Voice Profile. Analytics fully decoupled from UI. `externalIds` table enables
  non-duplicating repeat imports.
- **V2 (2.0.0)** — Quick Assessment (default tab); one-tap status; smart
  follow-up; **prediction engine** (statistical, no AI); progress dashboard;
  batch actions; **free-form tags** (`keywords`/`songKeywords`); multi-tag
  filtering.
- **V2.1 (2.1.0)** — **Consolidated the split rating fields** (the real cause of
  "placeholder-looking" stats): one set `demand/reliability/enjoyment/fatigue`
  (then 1–10) and one `RepertoireStatus`
  (`regular/occasional/learning/unexplored`) replacing two conflicting status
  concepts. Dexie **v3** data migration. Sliders → button grids. Real
  multi-select batch editing. Playlists imported + filterable. Lyrics removed.
- **V3 (3.0.0)** — **Five-point scale** (Very Low/Low/Average/Good/Excellent).
  Dexie **v4** migration (1–10 → 1–5). **Editable Key** (chromatic up/down).
  **Tracks removed**. **Interactive reports** (Stats + Voice Profile rows
  clickable → filtered Library). Two-stage assessment. Missing-metadata report.
  Import matches by StageTraxx ID then **artist+title fallback**; richer summary.
- **V3.1 (3.1.0)** — **Assess any filtered collection + metric checkboxes**.
  Terminology "Vocal Demand"/"Performance Reliability". **Instrumental mode**
  (relabels to Playing Demand/Physical Fatigue). Song Detail **Previous/Next +
  Save & back to the exact filtered view**. Transpose removed from editor/batch.
  **Suggested tags**. **Import moved under Assess**. Voice Profile **Recommended
  Key Changes**.
- **V4 (4.0.0)** — **Sync Wizard** (preview-diff, selective apply, assessments
  structurally protected; keys default off to protect local edits). Voice Profile
  **active-repertoire by default** + **Recommended Key Reviews** (ranked, ★
  confidence, suggested test key, reason). **Metadata Health** report (missing
  key/bpm/artist, no folder, duplicate titles). Batch **Notes + Key**. **Vocal
  Demand scale** → Very Low/Low/Average/**Tough/Challenging**. Intelligence prep:
  append-only **`assessmentHistory`** table + single `saveRating` helper +
  **`recommendationEngine`** (key reviews implemented; learn-next/forgotten
  starters; rest typed as roadmap). Dexie **v5** (additive only). Removed the old
  `ImportView`/`st4bImporter`.

## 3. Current database schema (Dexie v5 / raw IndexedDB v50)

`songs` (id; idx artistId/folderId/title/year/keyNote; fields incl. bpm,
duration, key note/accidental/quality, lyrics, notes, playCount, lastPlayed,
addedAt, updatedAt, **isInstrumental?**, reserved capo?/alternateTuning?) ·
`artists` (id, nameNormalized) · `folders` (id, name) · `tracks` (dormant since
V3) · `ratings` (**songId pk**; status/ratedAt idx; demand/reliability/enjoyment/
fatigue **nullable 1–5**, transpose dormant, notes; reserved audience/guitar/solo
fields) · **`assessmentHistory`** (id; songId/recordedAt idx; V4 append-only) ·
`externalIds` · `importLog` · `settings` · `playlists`/`playlistItems` ·
`keywords`/`songKeywords` (Tags) · `voiceProfileEntries` & `performanceHistory`
(reserved, unused).

Migrations: v1 initial · v2 adds performanceHistory · v3 consolidates old
difficulty/confidence + status/performanceFrequency · v4 rescales 1–10 → 1–5 ·
v5 adds assessmentHistory. All verified against the real multi-session upgrade
chain.

## 4. Compromises / known limitations

- **StageTraxx playlist/keyword JSON field names are a best guess** (defensive
  fallbacks) — never confirmed against a real export; the Sync Wizard's preview
  counts are the safety net. **#1 V5 priority: confirm the real schema.**
- **`assessmentHistory` is written but not yet read** (V4 prep for trend
  features); not pruned yet.
- **Recommended Key Reviews is a heuristic**, not vocal-range aware — framed as a
  suggestion with visible reasoning.
- `transpose` and `tracks` are dormant (kept, not dropped, for data safety).
- Analytics are purely statistical (the AI recommendation engine is deferred).
- **No committed automated test suite** — verification is via ad-hoc Playwright
  scripts against a synthetic DB / `.st4b`. The pure `analytics/*` + `syncEngine`
  functions are ideal future unit-test targets.

## 5. Known bugs

None currently known. Every migration and workflow has been verified end-to-end
with a headless browser, including the real v1→v5 Dexie upgrade chain and the
sync protection of local key edits + ratings.

---

*See `HANDOVER.md` for the full architecture, folder map, algorithms, technical
debt, and prioritised V5 recommendations.*
