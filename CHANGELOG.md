# Changelog

All notable changes to VocalDNA are recorded here.

## [5.0.0] — Version 5 (intelligent performance companion)

Reworks the whole workflow so VocalDNA feels like a performance companion, not
a database. Every screen now answers a decision. **No schema change** — still
Dexie version 5; the new coach-decision layer reuses the existing `settings`
table. See `HANDOVER_V5.md` for the full technical handover.

### New navigation

- Tabs are now **Home · Library · Insights · Assess**, and **Home is the
  default screen**. Home answers "What should I do today?": songs in library,
  songs assessed, Continue Assessing, a Vocal Efficiency Review preview, a
  Rediscover preview, a Library Health summary, and quick access to Library +
  Insights.
- **Insights** merges the old Statistics and Voice Profile into one section
  with four tabs — **Your Voice · Your Repertoire · Recommendations · Library
  Health** — every card clickable through to a filtered song list.
- Non-actionable charts removed (Recent Fatigue Trend, Weakest Keys by
  Reliability).

### Recommendations

- A dedicated **Recommendations** tab: Vocal Efficiency Review, Rediscover
  Songs, Ready for Promotion, Needs Practice, Songs to Learn Next, Hidden Gems,
  Recovery Songs, High Demand Songs — each opens the relevant list.

### Song Coach

- Every Song Detail now has a **Song Coach** — plain-language advice (High Vocal
  Demand, Reliable, Strong Opening Song, Good Recovery Song, Learning Progress)
  instead of raw stats. When a key review applies it shows the recommendation +
  reason + confidence with **Accept / Ignore / Test Later**. Accepting sets the
  key inside VocalDNA only. Changing the key by hand marks the song **Review
  Pending** until it's reassessed.

### Vocal Efficiency Review

- The key-review philosophy is renamed and made supportive: "Experiment with
  F#", "Experiment a little lower", or "Current key appears optimal" — never
  "you're singing it wrong."

### Library

- Filter options show counts, e.g. **"Country (184)"**, across Folders,
  Playlists, Artists, Keys, Status, and Tags.

## [4.0.0] — Version 4 (maintenance, sync, and intelligence prep)

Turns VocalDNA from a first-time assessment tool into an ongoing repertoire
maintenance and analysis system. Dexie bumped to **version 5** — additive
only (one new `assessmentHistory` table); no existing table, index, or data
was changed.

### Sync Wizard (replaces Import)

- A new **Sync Wizard** replaces the plain importer. It **previews every
  change before writing** (new songs, per-field metadata updates, new
  folders/playlists/keywords, name-matched songs, songs removed from the
  export), then applies only the categories you tick: New songs, Title &
  artist, Folders, BPM, Play counts, Playlists, Keywords→tags, Keys.
- **Smarter, safer sync (never overwrites assessments).** The sync engine
  only ever writes to source-owned tables (songs/artists/folders/playlists/
  keywords) and adds keywords additively, so **Ratings, Status, Notes, your
  Tags, and Assessment History are structurally out of reach** — a re-sync
  cannot touch them. Songs are matched by StageTraxx ID then artist+title, so
  an ID change can't duplicate a song. **Keys default to OFF** so keys you've
  changed inside VocalDNA are protected; tick Keys only if you want StageTraxx
  to win. Verified end-to-end (a local key edit + rating survived a re-sync
  while BPM updated).

### Voice Profile

- **Analyses active repertoire by default** (Regular + Occasional); Unexplored
  songs never skew it, and a toggle opts Learning in.
- **Recommended Key Reviews** (items 12/13) — a ranked working list of songs
  worth experimenting with, using high Vocal Demand, lower Performance
  Reliability, higher Vocal Fatigue, and nearby keys already succeeding in
  your own data. Shows current key → suggested test key, ★ confidence, and a
  plain-language reason; tapping opens the song. Not automatic key changes —
  the list for updating StageTraxx by hand.

### Statistics — Metadata Health

- A dedicated **Metadata Health** report: Missing Key, Missing BPM, Missing
  artist, No folder, and Duplicate titles — every row tappable through to the
  matching Library view. Every statistic remains live and clickable.

### Library batch editing

- Multi-select batch actions now also set **Notes** (append) and **Key**
  (VocalDNA-only), alongside Status / Vocal Demand / Performance Reliability /
  Tags / Clear ratings.

### Vocal Demand scale

- Vocal Demand now reads **Very Low / Low / Average / Tough / Challenging**
  (item 12) — a song rated Tough/Challenging is automatically a key-review
  candidate. Other metrics keep the generic 1-5 wording.

### Intelligence preparation

- New append-only **`assessmentHistory`** table; every rating save (assess,
  song editor, batch) now goes through a single `saveRating` helper that logs
  a timestamped snapshot — the timeline future "becoming stronger/weaker" and
  rotation features will read.
- New **`analytics/recommendationEngine.ts`** — the pure, statistical seam the
  future coach grows from. Implements key-review candidates, plus starter
  functions for "songs to learn next" and "forgotten songs", and documents the
  remaining roadmap kinds (hidden gems, trend, warm-up, setlist balancing,
  venue/dance/audience/encore/rotation) as typed placeholders the data model
  already supports.

### Removed

- The old `ImportView` and `st4bImporter` (superseded by `SyncWizard` +
  `syncEngine`).

## [3.1.0] — Version 3 final workflow improvements

Editing hundreds of songs should be fast and flexible. No schema migration —
the one new stored field (a song's instrumental flag) is optional and
non-indexed.

### Assess

- **Assess any filtered collection.** The Assess tab now has its own full
  filter panel (folder / playlist / artist / key / status / tags / search,
  all combinable) — it assesses exactly whatever the filters currently show
  (e.g. Country folder + Key G + a tag).
- **Choose which metrics to assess** with checkboxes — Vocal Demand,
  Performance Reliability, Enjoyment, Vocal Fatigue (and Status). Assess one
  or all; no forced order or two-pass sequence. Each song's card shows only
  the chosen metrics, and saving writes only those (never clobbering the
  others). Reassessment is allowed — the walk covers every filtered song, not
  just unrated ones. Previous/Next move through the queue.

### Terminology

- Demand → **Vocal Demand**, Reliability → **Performance Reliability**
  everywhere they're shown.

### Instrumental mode

- A song can be marked **Instrumental** (toggle in the Assess card and Song
  Detail). When it is, the labels re-read: Demand → *Playing Demand*,
  Fatigue → *Physical Fatigue*; Reliability and Enjoyment are unchanged.

### Song Detail / editing workflow

- **Previous / Next** buttons walk the exact filtered list the song was
  opened from — editing a folder's worth of songs is now a tight loop.
- **Save & back** returns to that same filtered view (e.g. back to the
  Country folder), not the whole library.
- **Transpose removed** — changing the Key is the mechanism that matters now.
  (The stored field is left dormant; nothing edits it.)

### Tags

- The tag editor now offers a curated set of common performance tags (Guitar
  Solo, Duet, Instrumental, Dance, Audience Favourite, Singalong, Opener,
  Encore, Christmas, Requests) as one-tap create-and-attach chips. Any custom
  tag can still be typed.

### Import

- Import moved **under the Assess tab** (a segmented Assess / Import switch)
  as the start of the assessment workflow; the Library tab is now purely for
  browsing. The top navigation is Assess / Library / Statistics / Voice
  Profile.

### Voice Profile

- New **Recommended key changes** report — for songs you rate lower on
  Performance Reliability that sit outside your most reliable key, it suggests
  the stronger key with the confidence gain and the exact reason
  (`You rate this 2/5 in C; you average 5.0/5 across 4 songs in G`). Purely
  statistical from your own ratings, always a suggestion. Replaces the now-
  removed Transpose Patterns section.

## [3.0.0] — Version 3

### Rating scale

- **Five-point scale replaces the 1-10 scale** for Demand, Reliability,
  Enjoyment, and Fatigue — five large 1-tap buttons (Very Low / Low /
  Average / Good / Excellent) instead of a 10-wide grid. Faster, more
  decisive, less false precision.
- Dexie bumped to version 4 with a data-only migration rescaling existing
  1-10 ratings onto 1-5 (a clean 2:1 bucketing). Verified against the
  actual multi-session upgrade path (Version 1 → 2 → 2.1 → 3, each step
  through genuine Dexie code, matching how a real device experiences these
  updates over time) — not just a synthetic fixture.
- Demand/Reliability/Enjoyment/Fatigue are now nullable on `Rating`,
  distinct from a real 1-5 value, so a song can have Pass One's fields set
  and Pass Two's not yet (see below).

### Two-stage assessment

- The Assess tab now runs three phases in strict order: **Status** (unchanged
  from Version 2) for every song, then **Pass One** (Demand & Reliability
  only) for every Regular/Occasional song, then **Pass Two** (Enjoyment &
  Fatigue only) — each phase fully completes across the whole library
  before the next begins, so every pass stays a two-question decision
  instead of a four-question one. Transpose and Notes moved to being edited
  only from the detailed rating form.

### Editable key

- A song's Key is now editable from Song Detail via up/down arrows cycling
  the chromatic scale. Writes only to VocalDNA's own `Song.keyNote` —
  StageTraxx is never touched. (A future "songs recommended for a key
  change" report was requested but deferred — it overlaps the explicitly
  out-of-scope recommendation engine.)

### Interactive reports

- Every bar, row, and quadrant in Statistics and Voice Profile now
  navigates: folders, keys, statuses, and artists jump to a matching
  Library filter; repertoire-map quadrants and the fatigue trend jump to
  the Library pre-filtered to exactly those songs. "Every analysis becomes
  navigation."

### Missing metadata report

- Statistics now lists every song missing Key or BPM ("Metadata needing
  completion"), each row opening that song directly, with a "View all in
  Library" bulk link — so gaps can be fixed at the source in StageTraxx.

### Smarter, safer import

- Songs are now matched by StageTraxx ID first, then — only if that ID has
  never been seen — by artist + title, so an ID changing between exports
  can no longer create a duplicate record and orphan the original's
  ratings/tags/history. Ratings, tags, notes-on-a-rating, status, and
  transpose live in tables the importer never touches, so a re-import can
  never erase an assessment.
- The import summary now reports new/updated songs, "potential conflicts"
  (songs matched by name instead of ID — worth a glance), songs removed
  from this export (reported only — nothing is ever auto-deleted), duplicate
  titles, and the missing-metadata count.
- **Tracks removed** — StageTraxx is the performance-track player;
  VocalDNA no longer imports or displays track data (the underlying table
  is left alone, just unused going forward).

### Deferred (Constitution "Long term — not yet")

Recommended key changes, song recommendations, setlist/encore/fatigue
prediction, and audience-based suggestions were explicitly requested for a
*later* phase, not this one, and are not built.

## [2.1.0] — Version 2.1 (correctness pass)

Focused entirely on making every Version 2 feature accurate, reliable, and
fast — no redesign, no new speculative features.

### Fixed — data model consolidation

Version 2 statistics looked wrong because Quick Assessment wrote to
`demand`/`reliability` while the detailed rating form wrote to a separate
`difficulty`/`confidence` (both left at their default of 3 unless touched),
so most rated songs showed a constant "3.0" average on fields nobody had
actually edited. There is now exactly one set of fields:

- `Rating.demand`/`reliability`/`enjoyment`/`fatigue` — all 1-10, all
  editable from every rating surface (Quick Assessment follow-up, detailed
  rating form, batch actions). Difficulty/Confidence are gone; Enjoyment and
  Fatigue moved from 1-5 to the same 1-10 scale.
- `Rating.status: RepertoireStatus` (`regular` / `occasional` / `learning` /
  `unexplored`) replaces both Version 1's five-value workflow `SongStatus`
  and Version 2's separate `performanceFrequency` — there was no reason for
  a song to have two different "status" concepts that never agreed with
  each other. "Unexplored" means "not yet in rotation," not "bad," and is
  the implicit default for any song with no rating row at all.
- Dexie bumped to version 3 with a data-only migration (no schema/index
  changes) that rescales existing 1-5 values onto 1-10 and maps old
  status/performanceFrequency combinations onto the new single status,
  preferring the more specific Version 2 signal where both exist. Verified
  end-to-end against a hand-built legacy-shaped database.
- Statistics, Voice Profile ("Strongest keys" / "Weakest keys", both now by
  Reliability), and the Assess progress dashboard all read from these
  consolidated fields, so every number reflects real ratings — nothing
  hardcoded or duplicated.
- Status breakdowns are now ordered by repertoire priority (Regular →
  Occasional → Learning → Unexplored), not by count.

### Added

- **Sliders replaced with 1-tap button grids** (`ScaleButtonGrid`,
  `StatusPicker`) everywhere a rating is entered — faster and more precise
  on iPad than dragging a slider.
- **Real multi-select batch editing** (Library "Select" mode) — tap
  individual songs, or filter to a folder/playlist and "Select all shown",
  then deselect individual songs from that selection. Six batch actions,
  each touching only the field it's responsible for: Change Status, Set
  Demand, Set Reliability, Set Transpose, Add Tags (never removes existing
  tags), and Clear Ratings.
- **Playlists** — StageTraxx playlists are now actually imported (the
  `playlists`/`playlistItems` tables were reserved but never populated in
  Version 1) and filterable in the Library alongside Folder. The exact
  StageTraxx JSON field names for playlist-song links haven't been
  confirmed against a real export, so the importer tries the same
  `songID`/`playlistID` convention used elsewhere and reports
  playlists/playlist-links found so a mismatch would be visible immediately
  rather than silently importing nothing.
- Filters (Search/Folder/Playlist/Artist/Key/Status/Tags) all compose
  together (logical AND) in the Library.

### Removed

- Lyrics are no longer shown on the Song Detail page — StageTraxx is the
  lyrics/chart viewer; VocalDNA is performance intelligence, not a
  duplicate. The underlying `Song.lyrics` field is untouched (still
  imported, just not displayed) since nothing needed it removed from the
  database.

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
