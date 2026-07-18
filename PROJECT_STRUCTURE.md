# Project Structure

```
vocaldna/
├── README.md                      How to run it, including iPad setup
├── CHANGELOG.md                   Version history
├── PROJECT_STRUCTURE.md           This file
├── package.json                   Dependencies + scripts (dev/build/preview)
├── tsconfig.json                  Strict TypeScript config for the whole project
├── vite.config.ts                 Vite + PWA plugin config (manifest, service worker)
├── index.html                     HTML entry point, iOS home-screen meta tags
│
├── public/
│   └── icons/
│       ├── icon-192.png           App icon (Android/manifest)
│       ├── icon-512.png           App icon (Android/manifest, maskable variant too)
│       └── apple-touch-icon.png   App icon (iOS home screen)
│
└── src/
    ├── main.tsx                   React root, mounts <App /> and imports global.css
    ├── vite-env.d.ts              Vite client type reference
    ├── App.tsx                    Tab shell (Assess / Library / Statistics /
    │                              Voice Profile — Import lives under Assess) +
    │                              song-detail routing. Holds the Library filter/
    │                              search state and the song "context list" so a
    │                              song's Previous/Next and "back to this view"
    │                              survive opening it (v3.1).
    │
    ├── styles/
    │   └── global.css             Dark, touch-friendly design system (iPad-tuned:
    │                              44px minimum tap targets, safe-area insets, etc.)
    │
    ├── components/                 Shared, cross-feature UI atoms
    │   ├── ScaleButtonGrid.tsx     1-tap five-point button grid (Version 3:
    │   │                          Very Low/Low/Average/Good/Excellent), replaces
    │   │                          sliders and the earlier 1-10 grid
    │   └── StatusPicker.tsx        1-tap 4-status picker (same visual language
    │                              as Quick Assessment's first screen)
    │
    ├── types/
    │   └── domain.ts              VocalDNA's own domain types + label helpers:
    │                              Song (+ CHROMATIC_NOTES for the key editor,
    │                              isInstrumental flag), Rating (nullable 1-5
    │                              metrics), RepertoireStatus, AssessMetric +
    │                              metricLabel()/assessMetricLabel() (vocal vs.
    │                              instrumental wording), SUGGESTED_TAGS, plus
    │                              ExternalIdMapping, ImportLogEntry, and reserved
    │                              types (Keyword/Tag, VoiceProfileEntry,
    │                              PerformanceHistoryEntry).
    │
    ├── db/
    │   ├── db.ts                  Dexie database class — the actual IndexedDB schema.
    │   │                          Table names/shapes are VocalDNA's own, not mirrored
    │   │                          from StageTraxx. Version 2 added the reserved
    │   │                          performanceHistory table; Version 3 (app v2.1)
    │   │                          consolidated Rating's fields; Version 4 (app v3)
    │   │                          rescales 1-10 ratings onto 1-5 — all data-only,
    │   │                          no index/schema changes past version 2.
    │   ├── useLiveQuery.ts        Small hook that re-runs a query when a dependency
    │   │                          (usually the global data version) changes
    │   └── dataVersion.ts         Global "data changed" counter — bumped after any
    │                              write (import, rating save) so every screen
    │                              reading that data refreshes automatically
    │
    ├── import/
    │   ├── idMapper.ts            Generic external-id ⇄ internal-UUID resolver.
    │   │                          This is what makes repeat imports update existing
    │   │                          rows instead of duplicating them, for ANY future
    │   │                          import source, not just StageTraxx.
    │   └── st4bImporter.ts        Reads a .st4b file (browser File object, read-only
    │                              by construction), unzips it with JSZip, maps
    │                              songs/artists/folders/playlists into VocalDNA's
    │                              schema inside a single Dexie transaction. Version 3
    │                              added artist+title fallback matching (a StageTraxx
    │                              ID changing between exports no longer creates a
    │                              duplicate) and a richer summary (potential
    │                              conflicts, removed songs, duplicate titles,
    │                              missing metadata). No longer imports tracks.
    │
    ├── analytics/
    │   ├── statsEngine.ts         Pure functions computing the Statistics dashboard's
    │   │                          data. Zero React/UI imports — takes plain arrays,
    │   │                          returns a plain object.
    │   ├── voiceProfileEngine.ts  Pure functions computing the Voice Profile
    │   │                          dashboard's data (key reliability, repertoire
    │   │                          quadrants, fatigue trend, and v3.1's
    │   │                          recommended key changes). Zero UI imports.
    │   └── predictionEngine.ts    Pure statistical learning (no AI): per-tag
    │                              demand/reliability/status averages blended into
    │                              a single per-song prediction (prefills Assess).
    │
    └── features/
        ├── import/
        │   └── ImportView.tsx           File picker + import trigger + result
        │                                 summary. Rendered inside the Assess tab
        │                                 (v3.1), not a top-level tab.
        │
        ├── assess/                      Assess workflow (v3.1)
        │   ├── AssessView.tsx           Assess/Import switch; owns the filter panel,
        │   │                            metric checkboxes, and the walk through the
        │   │                            filtered collection (reuses useLibraryData)
        │   ├── AssessCard.tsx           One song's card — shows only the chosen
        │   │                            metrics (vocal/instrumental-aware labels),
        │   │                            prefilled from prediction, Prev / Save&Next
        │   └── MetricToggles.tsx        Checkbox chips choosing which metrics to assess
        │
        ├── tags/                        Free-form tag system
        │   └── TagEditor.tsx            Per-song tag chip picker/creator with
        │                                 one-tap suggested tags (v3.1)
        │
        ├── library/
        │   ├── useLibraryData.ts        Shared hook: loads every table, builds the
        │   │                            lookup maps, and exposes one applyFilters so
        │   │                            Library and Assess filter identically (v3.1)
        │   ├── LibraryView.tsx          Controlled by App (filter/search props);
        │   │                            renders the grid + multi-select; hands the
        │   │                            ordered filtered list up when opening a song
        │   ├── SongCard.tsx             One song's card in the grid; supports
        │   │                            select-mode tap-to-toggle
        │   ├── FilterPanel.tsx          Folder / playlist / artist / key / status /
        │   │                            tag / songIds filter controls (shared by
        │   │                            Library and Assess)
        │   └── BatchActionsBar.tsx      Explicit multi-select batch actions: change
        │                                 status, set Vocal Demand / Performance
        │                                 Reliability, add tags (additive), clear ratings
        │
        ├── song-detail/
        │   ├── SongDetailView.tsx       Loads the song (one combined query) and lays
        │   │                            out metadata, the editable Key stepper, tags,
        │   │                            and Previous/Next through the context list.
        │   │                            No lyrics, no tracks, no transpose.
        │   └── SongEditor.tsx           Owns the rating state so Save & Previous &
        │                                 Next all persist the same edits (v3.1)
        │
        ├── stats/
        │   └── StatsView.tsx            Statistics dashboard UI. Every bar/row is
        │                                 clickable, navigating to a filtered Library.
        │
        └── voice-profile/
            └── VoiceProfileView.tsx      Voice Profile dashboard UI. Recommended key
                                           changes, quadrants, key rows, and the
                                           fatigue trend are all clickable.
```

## Architectural rules this structure enforces

- **UI never touches the database directly except through `db/db.ts`.**
  Every screen reads via `db.<table>` calls inside a `useLiveQuery`, and
  writes trigger `bumpDataVersion()` so other screens refresh.
- **Analytics never import React or any component.** `statsEngine.ts` and
  `voiceProfileEngine.ts` take arrays in, return plain data out — they could
  be unit-tested or reused by a future export feature without touching a
  single UI file.
- **Importers never use table names or shapes from the source system.**
  `st4bImporter.ts` maps StageTraxx's JSON into VocalDNA's own `Song` /
  `Artist` / `Folder` shapes; nothing downstream of the importer ever sees
  a StageTraxx-shaped object.
- **One folder per feature under `features/`.** Adding a tenth feature later
  means adding a tenth folder, not editing across the whole codebase.
- **Any analysis is navigation.** Statistics and Voice Profile never dead-end
  — every bar, row, and quadrant calls back up to `App.tsx`'s
  `onNavigateToLibrary`, which seeds the Library's filter state before
  switching tabs.
