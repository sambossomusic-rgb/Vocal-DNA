# Project Structure

> For the authoritative, up-to-date architecture + schema + roadmap, see
> **`HANDOVER.md`**. This file is the quick file-by-file map.


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
    │   │                          Versions v1–v5 (see HANDOVER.md); v5 (app v4) adds
    │   │                          the append-only assessmentHistory table.
    │   ├── saveRating.ts          THE single rating write path (v4): persists the
    │   │                          rating AND appends an assessmentHistory snapshot.
    │   ├── useLiveQuery.ts        Small hook that re-runs a query when a dependency
    │   │                          (usually the global data version) changes
    │   └── dataVersion.ts         Global "data changed" counter — bumped after any
    │                              write so every screen refreshes automatically
    │
    ├── import/
    │   ├── idMapper.ts            Generic external-id ⇄ internal-UUID resolver.
    │   └── syncEngine.ts          v4 — parseBackup / analyzeSync (read-only diff) /
    │                              applySync (writes only the ticked categories,
    │                              never ratings/history). Matches by StageTraxx ID
    │                              then artist+title. Replaces st4bImporter.
    │
    ├── analytics/                 ALL pure — arrays in, plain data out, no UI/DB.
    │   ├── statsEngine.ts         Statistics snapshot + Metadata Health (missing
    │   │                          key/bpm/artist, no folder, duplicate titles).
    │   ├── voiceProfileEngine.ts  Voice Profile (keys, quadrants, fatigue trend),
    │   │                          filtered to active repertoire by default (v4).
    │   ├── predictionEngine.ts    Per-tag/global demand/reliability/status
    │   │                          prediction (prefills Assess).
    │   └── recommendationEngine.ts v4 — key-review candidates (ranked, ★ confidence,
    │                              suggested test key, reason) + future-engine
    │                              scaffold (learn-next, forgotten, typed roadmap).
    │
    └── features/
        ├── import/
        │   └── SyncWizard.tsx           v4 — preview every change, tick which
        │                                 categories to apply, summary. Rendered
        │                                 inside the Assess tab's Sync sub-mode.
        │
        ├── assess/                      Assess workflow
        │   ├── AssessView.tsx           Assess/Sync switch; owns the filter panel,
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
        │   └── BatchActionsBar.tsx      Multi-select batch actions: status, Vocal
        │                                 Demand, Performance Reliability, Key, Notes
        │                                 (append), Tags (additive), clear ratings (v4)
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
        │   └── StatsView.tsx            Statistics dashboard UI (clickable) +
        │                                 Metadata Health report (v4).
        │
        └── voice-profile/
            └── VoiceProfileView.tsx      Voice Profile UI: active-repertoire scope
                                           toggle, Recommended Key Reviews (★), keys,
                                           quadrants, fatigue trend — all clickable (v4).
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
