# VocalDNA — Technical Handover (post-V4)

**Audience:** ChatGPT (and any future contributor) planning V5.
**Goal:** enough detail to continue development *without inspecting the codebase*.
**Version at handover:** 4.0.0 · **Live:** https://sambossomusic-rgb.github.io/Vocal-DNA/

---

## 1. What VocalDNA is (and is not)

VocalDNA is a **local-first PWA** that imports a **StageTraxx4 (`.st4b`)** backup
into its own on-device database and layers **repertoire assessment + analytics**
on top. StageTraxx stays the live performance manager; VocalDNA is the
**performance-intelligence / repertoire-optimisation** layer. The long-term
vision is an **intelligent performance coach**, not a StageTraxx replacement.
Favour analytical intelligence over feature duplication.

**Hard constraints (from the project constitution):**
- 100% local. Nothing is uploaded. The `.st4b` file is read-only (browser
  `File` objects have no write API).
- Speed beats beauty; minimum taps; iPad-first (44px targets, five-button
  ratings).
- Predictions are suggestions; the performer is the final authority.
- No AI/ML — all "intelligence" is **pure statistics** over the user's own data.

---

## 2. Tech stack

- **React 18 + TypeScript (strict, `noUnusedLocals`/`noUnusedParameters` on)**
- **Vite 5** build; **vite-plugin-pwa** (offline service worker + manifest)
- **Dexie 3** over **IndexedDB** (the only persistence)
- **JSZip** to read `.st4b` archives in-browser
- No backend, no network calls at runtime, no state library (React state + a
  tiny global "data changed" counter)
- Deployed to **GitHub Pages** via `.github/workflows/deploy.yml` on push to
  `main`. `vite.config.ts` uses `base: './'` (relative asset paths) so it works
  under the Pages subpath.

---

## 3. Architecture & data flow

Strict layering, enforced by convention:

```
IndexedDB (Dexie)  ──►  db/ (schema + saveRating helper)
        ▲                     │
        │                     ▼
   import/ (syncEngine)   analytics/ (pure functions: stats, voiceProfile,
        │                            prediction, recommendation)
        │                     │
        ▼                     ▼
   features/*  ── read via useLiveQuery / useLibraryData, render, and
                  write via db.* + saveRating; every write calls
                  bumpDataVersion() so all screens refetch.
        ▲
        │
      App.tsx  (tab shell, holds cross-screen state: library filters+search,
                open-song id + its "context list" for Prev/Next)
```

**Golden rules (keep these in V5):**
1. **UI never touches IndexedDB except through `db/`.** Screens read with
   `useLiveQuery`/`useLibraryData` and write with `db.*` + `saveRating`, then
   call `bumpDataVersion()`.
2. **`analytics/` is pure** — arrays in, plain objects out, zero React/DB/UI
   imports. Every dashboard is a dumb renderer of an analytics result. This is
   what makes the intelligence layer testable and reusable.
3. **Importers/sync never leak source shapes.** `syncEngine` maps StageTraxx
   JSON into VocalDNA's own types; nothing downstream sees an St4b-shaped object.
4. **One folder per feature** under `features/`.
5. **Assessments are sacred.** Sync only writes source-owned tables; it never
   opens `ratings` / `assessmentHistory`.

**Reactivity:** `db/dataVersion.ts` is a module-level counter + listener set.
`bumpDataVersion()` after any write; `useDataVersion()` re-renders subscribers;
`useLiveQuery(fn, [dataVersion, …], initial)` re-runs the query. Simple and
sufficient — no Dexie live-queries.

---

## 4. Folder structure

```
src/
├── main.tsx, App.tsx            App = tab shell + song-detail routing + the
│                                cross-screen state (library filters/search,
│                                open song id, the song's "context list")
├── styles/global.css            Dark, iPad-tuned design system
├── components/                  Shared UI atoms
│   ├── ScaleButtonGrid.tsx      Five 1-tap buttons; optional per-metric scaleLabels
│   └── StatusPicker.tsx         Four-status 1-tap picker
├── types/domain.ts              ALL domain types + label helpers + small consts
├── db/
│   ├── db.ts                    Dexie schema + versioned migrations (v1–v5)
│   ├── saveRating.ts            THE rating write path (rating + history snapshot)
│   ├── useLiveQuery.ts          re-run-on-deps query hook
│   └── dataVersion.ts           global "data changed" counter
├── import/
│   ├── idMapper.ts              external-id ⇄ internal-UUID resolver
│   └── syncEngine.ts            parseBackup / analyzeSync / applySync (V4)
├── analytics/                   PURE, no UI/DB imports
│   ├── statsEngine.ts           Statistics snapshot (+ metadata health)
│   ├── voiceProfileEngine.ts    Voice Profile (keys, quadrants, fatigue trend)
│   ├── predictionEngine.ts      per-tag/global demand/reliability/status prediction
│   └── recommendationEngine.ts  key-review candidates + future-engine scaffold
└── features/
    ├── assess/                  AssessView (Assess/Sync switch, filtered queue,
    │                            metric checkboxes), AssessCard, MetricToggles
    ├── import/SyncWizard.tsx     preview → tick categories → apply → summary
    ├── library/                 LibraryView (controlled by App), SongCard,
    │                            FilterPanel, BatchActionsBar, useLibraryData
    ├── song-detail/             SongDetailView (loads + key stepper + Prev/Next),
    │                            SongEditor (owns rating state; Save/Prev/Next)
    ├── tags/TagEditor.tsx        per-song tags + suggested one-tap tags
    ├── stats/StatsView.tsx       clickable stats + Metadata Health
    └── voice-profile/VoiceProfileView.tsx  active-repertoire scope + key reviews
```

---

## 5. Database schema (Dexie v5 / raw IndexedDB v50)

Database name: `vocaldna`. Dexie multiplies declared versions by 10 internally
(v5 → IndexedDB 50) — **matters for writing migration tests**; use raw versions
10/20/30/40/50 when hand-building a legacy DB in a test.

| Table | Key / indexes | Notes |
|---|---|---|
| `songs` | `id`, idx `artistId, folderId, title, year, keyNote` | + `bpm, duration, keyNote/Accidental/Quality, lyrics, notes, playCount, lastPlayed, addedAt, updatedAt, isInstrumental?` (+ reserved `capo?, alternateTuning?`). `lyrics` still imported, never shown. |
| `artists` | `id`, idx `nameNormalized` | matched by normalized name (StageTraxx has no artist id) |
| `folders` | `id`, idx `name` | |
| `tracks` | `id`, idx `songId` | **dormant since V3** — not imported or shown |
| `ratings` | **`songId` (pk)**, idx `status, ratedAt` | `demand/reliability/enjoyment/fatigue` **nullable RatingValue (1–5)**, `transpose` (dormant), `status: RepertoireStatus`, `notes`, `ratedAt` (+ reserved audience/guitar/solo fields) |
| `assessmentHistory` | `id`, idx `songId, recordedAt` | **V4** append-only snapshot on every rating save |
| `externalIds` | `[entityType+sourceSystem+sourceId]`, idx `internalId` | source id ⇄ internal UUID; enables non-duplicating re-sync |
| `importLog` | `++id`, idx `startedAt` | |
| `settings` | `key` | unused so far |
| `playlists` / `playlistItems` | `id` / `id`,idx`playlistId,songId` | imported from StageTraxx (playlistItems id = `playlistInternal:songInternal`) |
| `keywords` / `songKeywords` | `id` / `[songId+keywordId]` | the **Tags** system (user-created + synced StageTraxx keywords) |
| `voiceProfileEntries`, `performanceHistory` | reserved | unused |

**Migrations (all verified against the real multi-session upgrade chain):**
- v1 initial. v2 adds `performanceHistory`. v3 consolidates old
  `difficulty/confidence` + `status/performanceFrequency` → single
  `demand/reliability` (1–10) + `RepertoireStatus`. v4 rescales 1–10 → 1–5
  (`Math.ceil(v/2)`). **v5 adds `assessmentHistory`** (additive; no transform).

**Key domain types** (`types/domain.ts`):
- `RatingValue = 1|2|3|4|5`; `RATING_SCALE_LABELS` (Very Low…Excellent);
  `DEMAND_SCALE_LABELS` (Very Low/Low/Average/**Tough/Challenging**);
  `scaleLabelsForMetric(metric)`; `DEMAND_REVIEW_THRESHOLD = 4`.
- `RepertoireStatus = regular|occasional|learning|unexplored` (+ LABELS,
  PRIORITY). "Unexplored" = not in rotation, not "bad"; it's the default for an
  unrated song.
- `NumericMetric`, `AssessMetric = status|<numeric>`, `metricLabel(metric,
  isInstrumental)` (vocal vs Playing Demand/Physical Fatigue).
- `AssessmentHistoryEntry`, `createDefaultRating`, `CHROMATIC_NOTES`,
  `SUGGESTED_TAGS`.

---

## 6. Key algorithms (all pure, statistical)

- **predictionEngine** — per-tag and global averages of demand/reliability +
  status mode from the user's prior ratings; blended into a per-song
  prediction that prefills the Assess card. No transpose (removed in V3.1).
- **voiceProfileEngine** — filters to `includeStatuses` (default Regular+
  Occasional), computes per-key avg reliability/demand (strongest/weakest
  keys), a demand×reliability quadrant map, and a fatigue trend. Pure.
- **recommendationEngine.computeKeyReviewCandidates** — the V4 headline. For
  active-repertoire songs that are **Tough/Challenging (demand ≥ 4) or
  struggling (reliability ≤ 2)**: score = `demand + (6−reliability) + fatigue`;
  suggested test key = a nearby key (±1/±2 semitones) where the user's own avg
  reliability is higher (else a gentle −1 semitone for demanding songs);
  confidence 1–5 stars from demand/reliability/fatigue strength; plain-language
  reason. Also `computeSongsToLearnNext` and `computeForgottenSongs` (simple
  starters), plus `FutureRecommendationKind` documenting the roadmap.
- **syncEngine** — `parseBackup(file)` → `analyzeSync(backup)` (read-only diff:
  new songs, per-field update counts, new folders/playlists/keywords, name
  matches, removed songs) → `applySync(backup, options, file)` (writes only
  ticked categories; keywords additive; never opens ratings/history). Song
  resolution: StageTraxx id → artist+title fallback.
- **statsEngine** — live counts, key distribution, per-field metric averages
  (null-aware), status distribution (priority-ordered), top artists, and
  **metadata health** (missing key/bpm/artist, no folder, duplicate titles).

---

## 7. Feature inventory (what exists at V4)

- **Assess tab** = workflow hub with an **Assess / Sync** sub-switch. Assess any
  filtered collection (folder/playlist/artist/key/status/tags/search); tick
  which metrics to rate (Status + the four numerics); five-button ratings;
  Instrumental toggle (relabels Demand/Fatigue); prediction-prefill;
  Prev/Save&Next through the queue.
- **Sync Wizard** — preview-diff, selective apply, protected assessments.
- **Library** — search + all filters, multi-select batch (Status, Vocal Demand,
  Performance Reliability, Tags, Notes, Key, Clear ratings), opens Song Detail
  with the ordered context list.
- **Song Detail** — editable Key (chromatic ±, VocalDNA-only), Tags (+ suggested),
  full rating editor; **Previous/Next** across the filtered list; **Save & back**
  to the exact filtered view.
- **Statistics** — live, every row clickable → filtered Library; Metadata Health.
- **Voice Profile** — active-repertoire scope (toggle Learning), Recommended Key
  Reviews (stars), strongest/weakest keys, repertoire map, fatigue trend — all
  clickable.

---

## 8. Compromises, technical debt, known limitations

- **StageTraxx playlist/keyword JSON field names are unconfirmed.** `syncEngine`
  uses defensive fallbacks (`playlistID`/`playlistId`, `songID`/`songId`,
  `keywordID`/`keywordId`). The **preview + summary counts are the safety net** —
  if they read 0 despite the file having playlists/keywords, the field names are
  wrong. **V5 priority: confirm against a real export.** No real `.st4b` has ever
  been available in development; all tests use synthetic archives.
- **`AssessView` state is local**, so switching away from the Assess tab and back
  resets the filter/metrics/queue position. Acceptable but noted.
- **`assessmentHistory` is written but not yet read** by any feature (it's V4
  prep). It also isn't pruned — high-volume reassessment grows it unbounded
  (fine for IndexedDB scale, but a future concern).
- **Clearing a rating (batch) does not delete its history** — intentional (log),
  but means an "unrated" song can have history.
- **`transpose` and `tracks` are dormant** (kept, not dropped, for data safety).
- **Recommended Key Reviews is a heuristic**, not vocal-range aware. It's framed
  as a suggestion with visible reasoning; the performer decides.
- **`recommendationEngine` roadmap kinds are typed but unimplemented** (by design
  — the constitution defers the full engine).
- **No automated test suite in-repo.** Verification is done via ad-hoc Playwright
  scripts against a synthetic DB/`.st4b`. **V5 should add a committed test
  harness** (the pure `analytics/` + `syncEngine` functions are ideal unit-test
  targets; they need no DOM).
- **No known runtime bugs.** Migrations and every workflow above were verified
  end-to-end (including the real v1→v5 Dexie upgrade chain and sync protection of
  local key edits + ratings).

---

## 9. Recommended V5 priorities

1. **Confirm the real `.st4b` schema** (playlists, keywords, song/playlist link
   field names, play counts) against an actual export; fix `syncEngine`
   fallbacks; add a "fields not recognised" warning to the wizard.
2. **Read `assessmentHistory`** — ship the first trend features:
   *Songs becoming stronger / weaker* and *Rotation / Forgotten* (data + engine
   scaffolds already exist). Add history pruning/compaction.
3. **Commit a test suite** — unit tests for `analytics/*` and `syncEngine`
   (pure), plus a couple of Playwright smoke flows; wire into the deploy action.
4. **Grow `recommendationEngine`** toward the coach: hidden gems, setlist
   balancing, warm-up suggestions, encore/audience-favourite (tags already
   support "Audience Favourite" etc.). Keep it pure + statistical.
5. **Set-building assistant** (a new feature folder) reading demand/fatigue/
   status to sequence a set and cap cumulative vocal fatigue.
6. **Persist Assess-tab state** (lift to App or a store) so long maintenance
   sessions survive tab switches.
7. **Optional:** richer key-review model (per-key sample confidence, vocal-range
   input), and a "review candidates" surface inside Assess, not just Voice
   Profile.

---

## 10. Build / deploy / test quick reference

- `npm install`; `npm run dev` (Vite); `npm run build` (`tsc --noEmit && vite
  build`); `npm run preview`.
- Push to `main` → GitHub Actions (`deploy.yml`) builds and publishes to Pages.
  (One-time: repo Settings → Pages → Source = GitHub Actions.)
- Migration tests must build the legacy DB at **raw** IndexedDB versions
  (×10 of the Dexie version).
- The pure `analytics/*` and `syncEngine` functions are the highest-value,
  lowest-friction things to unit-test — no DOM required.
