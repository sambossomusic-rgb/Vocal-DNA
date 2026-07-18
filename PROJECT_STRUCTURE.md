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
    ├── App.tsx                    Tab navigation shell (Library / Statistics /
    │                              Voice Profile / Import) + song detail routing
    │
    ├── styles/
    │   └── global.css             Dark, touch-friendly design system (iPad-tuned:
    │                              44px minimum tap targets, safe-area insets, etc.)
    │
    ├── components/                 Version 2.1 — shared, cross-feature UI atoms
    │   ├── ScaleButtonGrid.tsx     1-tap 1-10 button grid, replaces sliders
    │   └── StatusPicker.tsx        1-tap 4-status picker (same visual language
    │                              as Quick Assessment's first screen)
    │
    ├── types/
    │   └── domain.ts              VocalDNA's own domain types: Song, Artist, Folder,
    │                              Track, Rating, RepertoireStatus (Version 2.1,
    │                              replaces SongStatus + PerformanceFrequency),
    │                              ExternalIdMapping, ImportLogEntry, Setting,
    │                              createDefaultRating(), and reserved types for
    │                              future features (Keyword/Tag, VoiceProfileEntry,
    │                              PerformanceHistoryEntry). Playlist/PlaylistItem
    │                              are active as of Version 2.1.
    │
    ├── db/
    │   ├── db.ts                  Dexie database class — the actual IndexedDB schema.
    │   │                          Table names/shapes are VocalDNA's own, not mirrored
    │   │                          from StageTraxx. Version 2 added the reserved
    │   │                          performanceHistory table; Version 3 (2.1) runs a
    │   │                          data-only migration consolidating Rating's fields
    │   │                          (see CHANGELOG) — no index/schema changes.
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
    │                              songs/artists/folders/tracks/playlists (Version
    │                              2.1) into VocalDNA's schema inside a single Dexie
    │                              transaction.
    │
    ├── analytics/
    │   ├── statsEngine.ts         Pure functions computing the Statistics dashboard's
    │   │                          data. Zero React/UI imports — takes plain arrays,
    │   │                          returns a plain object.
    │   ├── voiceProfileEngine.ts  Pure functions computing the Voice Profile
    │   │                          dashboard's data (key reliability, transpose
    │   │                          patterns, repertoire quadrants, fatigue trend).
    │   │                          Also zero UI imports.
    │   ├── predictionEngine.ts    Pure statistical learning (no AI): per-tag
    │   │                          demand/reliability/status averages and per-key
    │   │                          transpose averages, blended into a single
    │   │                          per-song prediction.
    │   └── progressEngine.ts      Pure function computing the Assess tab's
    │                              progress dashboard numbers.
    │
    └── features/
        ├── import/
        │   └── ImportView.tsx           File picker + import trigger + result summary
        │
        ├── assess/                      Quick Assessment mode
        │   ├── AssessView.tsx           Owns the assessment queue, progress header,
        │   │                            and routes between the two cards below
        │   ├── QuickAssessCard.tsx       The one-question, one-tap screen
        │   └── FollowUpCard.tsx         Demand/Reliability/Transpose/Notes (button
        │                                 grids), prefilled from predictionEngine,
        │                                 one-tap "Save & Next"
        │
        ├── tags/                        Free-form tag system
        │   └── TagEditor.tsx            Per-song tag chip picker/creator, used from
        │                                 Song Detail
        │
        ├── library/
        │   ├── LibraryView.tsx          Loads songs/artists/folders/playlists/
        │   │                            ratings/tags, wires search + filters +
        │   │                            multi-select together, renders the grid
        │   ├── SongCard.tsx             One song's card in the grid; supports
        │   │                            select-mode tap-to-toggle
        │   ├── FilterPanel.tsx          Folder / playlist / artist / key / status /
        │   │                            tag (multi) filter controls
        │   └── BatchActionsBar.tsx      Version 2.1 — explicit multi-select batch
        │                                 actions: change status, set demand/
        │                                 reliability/transpose, add tags (additive
        │                                 only), clear ratings
        │
        ├── song-detail/
        │   └── SongDetailView.tsx       Full song detail: metadata, tracks, tags,
        │                                 embeds the rating form. No lyrics — that's
        │                                 StageTraxx's job (Version 2.1).
        │
        ├── rating/
        │   └── RatingForm.tsx           Status picker, Demand/Reliability/Enjoyment/
        │                                 Fatigue button grids, Transpose stepper,
        │                                 Notes textarea, Save button.
        │
        ├── stats/
        │   └── StatsView.tsx            Statistics dashboard UI (renders statsEngine
        │                                 output only — no calculation logic here)
        │
        └── voice-profile/
            └── VoiceProfileView.tsx      Voice Profile dashboard UI (renders
                                           voiceProfileEngine output only)
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
  `Artist` / `Folder` / `Track` shapes; nothing downstream of the importer
  ever sees a StageTraxx-shaped object.
- **One folder per feature under `features/`.** Adding a tenth feature later
  means adding a tenth folder, not editing across the whole codebase.
