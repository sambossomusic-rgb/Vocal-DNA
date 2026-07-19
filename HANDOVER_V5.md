# VocalDNA — V5 Developer Handover

**For:** ChatGPT · **Prepared by:** Claude
**Version:** 5.0.0 · **Live:** https://sambossomusic-rgb.github.io/Vocal-DNA/
**Companion docs:** `HANDOVER.md` (deep reference), `DEVELOPMENT_REPORT.md` (V1–V4 state)

---

## 1. What V5 set out to do

Turn VocalDNA "from a database into an intelligent performance companion." Same
constitution: 100% on-device, nothing uploaded, no AI/ML — pure statistics.
StageTraxx stays the live performance manager; VocalDNA is the
repertoire-optimisation / performance-intelligence layer. Every screen now
answers a **decision** ("what should I do today / tonight / with this song?"),
never just "here are numbers."

## 2. Navigation — the big structural change

Old tabs: **Assess · Library · Statistics · Voice Profile**.
New tabs: **Home · Library · Insights · Assess** (Home is the new default).

- **Home** (`features/home/HomeView.tsx`) — the front door. Answers "What should
  I do today?": songs in library, songs assessed (%), Continue Assessing
  (unexplored count → Assess), a Vocal Efficiency Review preview, a Rediscover
  preview, a Library Health summary, and quick access to Library + Insights.
  Empty library shows a friendly get-started card.
- **Insights** (`features/insights/InsightsView.tsx`) — **Voice Profile and
  Statistics merged** into one section with four sub-tabs: **Your Voice**,
  **Your Repertoire**, **Recommendations**, **Library Health**. Controlled
  sub-tab (App owns the state) so Home can deep-link straight to any tab. Every
  card opens a filtered Library list.
- **Assess** and **Library** are unchanged in role (Assess still hosts Sync).

Non-actionable charts were **deleted**: Recent Fatigue Trend and Weakest Keys
by Reliability are gone (they didn't drive a decision).

## 3. New / changed algorithms (all pure, in `analytics/`)

`recommendationEngine.ts` gained the V5 recommendation set — each a pure
`(songs, ratings) → SongSuggestion[]`, ranked and capped:

- `computeRediscoverSongs` — active + rated-well + not played in a long time.
- `computeSongsReadyForPromotion` — Learning + reliability ≥ 4.
- `computeSongsNeedingPractice` — active + reliability ≤ 2.
- `computeHiddenGems` — enjoyment ≥ 4 & reliability ≥ 4, not yet Regular.
- `computeRecoverySongs` — active + fatigue ≤ 2 & reliability ≥ 4.
- `computeHighDemandSongs` — demand ≥ 4 (Tough/Challenging).
- (kept: `computeSongsToLearnNext`, `computeKeyReviewCandidates`.)

**Vocal Efficiency Review** (item 12) — the key-review philosophy renamed and
softened. `computeVocalEfficiencyReview(song, rating, allSongs, allRatings)`
returns one of four supportive verdicts: `experiment-specific-key`,
`experiment-lower`, `optimal` ("Current key appears optimal"), or
`no-recommendation`. It reuses `computeKeyReviewCandidates` so a song's key
advice is identical wherever it appears. Language is pedagogy-aligned — never
"you're singing it wrong."

`songCoachEngine.ts` (new) — `computeSongCoach(...)` turns one song's ratings
into plain-language advice: High Vocal Demand, Reliable in performance, Strong
opening song, Good recovery song, Learning progress / Ready to promote — plus
the embedded Vocal Efficiency Review. Pure; no UI/DB imports.

## 4. Song Coach + decision state (item 4)

`features/song-detail/SongCoachCard.tsx` renders the coach on every Song Detail.
For a real key-review candidate it shows the recommendation + reason +
confidence (★) and three actions:

- **Accept recommendation** → sets the song's VocalDNA `keyNote` to the
  suggested key (VocalDNA-only, never StageTraxx) and records `accepted`.
- **Ignore** → records `ignored` (with a Reconsider link).
- **Test later** → records `test-later` (keeps the buttons available).

**Manual key change** via the ▲/▼ stepper on Song Detail now marks the song
**Review Pending** and the coach shows that state until the song is reassessed.
**Reassessing** (saving in `SongEditor`) clears the coach state so a fresh
recommendation can surface.

Decision state lives in the existing **`settings`** table under key
`coach:{songId}` (`db/coachState.ts`) — **no schema migration**. It is
VocalDNA-only and never touches ratings/assessmentHistory or StageTraxx fields.

## 5. Other UI changes

- **Library filter counts** (item 7) — Folders/Playlists/Artists/Keys/Status/
  Tags now show counts, e.g. "Country (184)". Counts are computed once over the
  whole library in `useLibraryData` and passed through `FilterPanel`
  (`FilterCounts`). Applies to both Library and Assess (they share the panel).
- **Metadata Health** moved into **Insights → Library Health** (Missing Key/BPM/
  Artist, Unknown Folder, Duplicate Titles — all clickable).
- **Vocal Demand** wording (Very Low/Low/Average/**Tough/Challenging**) is used
  consistently; Tough/Challenging feed the Vocal Efficiency Review and High
  Demand list.
- Sync Wizard, assessment protection, editable key, Prev/Next, save-and-return
  are all unchanged.

## 6. Database

**No schema version bump** — still Dexie **v5 / raw IndexedDB v50**. V5 adds
only the `settings`-backed coach layer, which reuses an existing table. The
`assessmentHistory` table (written since V4) is still written on every
`saveRating` and remains available for future trend work; V5 does not yet read
it.

## 7. Files added / changed

- **Added:** `features/home/HomeView.tsx`, `features/insights/InsightsView.tsx`,
  `features/insights/SuggestionList.tsx`, `features/insights/KeyReviewList.tsx`,
  `features/song-detail/SongCoachCard.tsx`, `analytics/songCoachEngine.ts`,
  `db/coachState.ts`.
- **Changed:** `App.tsx` (new nav + deep-link handlers),
  `analytics/recommendationEngine.ts` (V5 kinds + Vocal Efficiency Review),
  `features/library/FilterPanel.tsx` + `useLibraryData.ts` (counts),
  `features/library/LibraryView.tsx`, `features/assess/AssessView.tsx` (pass
  counts), `features/song-detail/SongDetailView.tsx` (coach + Review Pending on
  manual key change), `features/song-detail/SongEditor.tsx` (clear coach state
  on reassess), `package.json` (5.0.0).
- **Removed:** `features/stats/StatsView.tsx`,
  `features/voice-profile/VoiceProfileView.tsx` (merged into Insights).

## 8. Verification

`tsc --noEmit && vite build` is clean. Headless Chromium (Playwright) against a
seeded synthetic DB confirmed: Home renders and counts, all four Insights tabs
render, Recommendation lists populate, Library filter counts show, Song Coach
renders, and the full **Vocal Efficiency Review → Accept (key G#→A) → Undo →
manual-key → Review Pending** flow works with **zero console errors**. Assess
and Sync still work.

## 9. Known limitations / tech debt (unchanged or new)

- StageTraxx playlist/keyword JSON field names are still a best-guess (defensive
  fallbacks; Sync preview counts are the safety net). **Still the #1 thing to
  confirm against a real export.**
- `assessmentHistory` is written but not yet read — V6 "becoming stronger /
  weaker" and rotation analyses are the intended readers.
- Recommendations are heuristic and **not vocal-range aware** — all framed as
  supportive suggestions with visible reasoning.
- Home/Insights recompute their recommendation lists on each render (memoised
  per data version); fine at library sizes seen so far, but the pure engines are
  the natural place to add caching if a very large library ever feels slow.
- Assess view state still resets on tab switch (pre-existing).
- No committed automated test suite — verification remains ad-hoc Playwright
  scripts. The pure `analytics/*` + `syncEngine` + `songCoachEngine` functions
  are ideal first unit-test targets.

## 10. Suggested V6 directions

- Read `assessmentHistory`: trend badges ("improving / slipping") on Song Coach
  and a Recommendations "Becoming stronger / weaker" list.
- **Setlist builder**: assemble a set from Recommendations (opener → demanding →
  recovery pacing) using the existing recovery/high-demand/opener signals.
- Confirm the StageTraxx playlist/keyword schema and tighten the importer.
- Persisted Vocal Efficiency Review outcomes → a "what I tried and kept" log.
- First real unit tests around the pure engines.

*— End of V5 handover.*
