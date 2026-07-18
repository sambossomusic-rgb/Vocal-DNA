/**
 * VocalDNA's own domain model. These shapes belong to the application, not to
 * any import source. StageTraxx (and later OnSong, MusicXML, ChordPro, ...)
 * are mapped INTO these types by their respective importers — nothing in the
 * rest of the app ever depends on a source-specific shape.
 */

export interface Artist {
  id: string; // VocalDNA-owned UUID
  name: string;
  nameNormalized: string; // lowercased/trimmed, used for de-dup matching
}

export interface Folder {
  id: string; // VocalDNA-owned UUID
  name: string;
}

/** Canonical chromatic ordering, used to step Song.keyNote up/down (Constitution Priority 2). */
export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface Song {
  id: string; // VocalDNA-owned UUID
  title: string;
  artistId: string | null;
  folderId: string | null;
  year: number | null;
  bpm: number | null;
  duration: number | null; // seconds
  keyNote: string | null;
  keyAccidental: number | null;
  keyQuality: number | null;
  lyrics: string | null;
  notes: string | null;
  playCount: number;
  lastPlayed: string | null; // ISO timestamp
  addedAt: string | null; // ISO timestamp
  updatedAt: string; // ISO timestamp, set by VocalDNA on every write

  // Version 3 workflow update — an instrumental number. When true, the vocal
  // metric labels re-read as playing/physical (see metricLabel). Optional and
  // non-indexed, so it needs no schema migration; absent means "vocal".
  isInstrumental?: boolean;

  // --- Reserved for future features (see Constitution Feature 9). Not
  // populated or editable by any screen yet. ---
  capo?: number | null;
  alternateTuning?: string | null;
}

/**
 * Reserved — Version 3 stopped importing/displaying track data entirely
 * (Constitution Priority 3: "provides no useful information"). The table
 * and any pre-existing rows are left alone rather than destructively
 * dropped, but nothing reads or writes through this type anymore.
 */
export interface Track {
  id: string; // VocalDNA-owned UUID
  songId: string;
  number: number | null;
  name: string | null;
  filePath: string | null;
  duration: number | null;
  volume: number | null;
  muted: boolean;
}

/** The five-point rating scale used for every rating dimension (Constitution Priority 1). */
export const RATING_SCALE = [1, 2, 3, 4, 5] as const;
export type RatingValue = 1 | 2 | 3 | 4 | 5;

export const RATING_SCALE_LABELS: Record<RatingValue, string> = {
  1: 'Very Low',
  2: 'Low',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

/**
 * The four numeric rating dimensions, plus the special `status` axis. The
 * Version 3 workflow update lets the performer choose which of these to
 * assess (Assess tab) rather than forcing a fixed order.
 */
export type NumericMetric = 'demand' | 'reliability' | 'enjoyment' | 'fatigue';
export type AssessMetric = 'status' | NumericMetric;

export const NUMERIC_METRICS: NumericMetric[] = ['demand', 'reliability', 'enjoyment', 'fatigue'];
export const ASSESS_METRICS: AssessMetric[] = ['status', ...NUMERIC_METRICS];

/**
 * User-facing label for a numeric metric. Demand and Fatigue re-read for an
 * instrumental number (Playing Demand / Physical Fatigue); Reliability and
 * Enjoyment are the same either way.
 */
export function metricLabel(metric: NumericMetric, isInstrumental = false): string {
  switch (metric) {
    case 'demand':
      return isInstrumental ? 'Playing Demand' : 'Vocal Demand';
    case 'reliability':
      return 'Performance Reliability';
    case 'enjoyment':
      return 'Enjoyment';
    case 'fatigue':
      return isInstrumental ? 'Physical Fatigue' : 'Vocal Fatigue';
  }
}

export function assessMetricLabel(metric: AssessMetric, isInstrumental = false): string {
  return metric === 'status' ? 'Status' : metricLabel(metric, isInstrumental);
}

/**
 * A small starter palette of common performance tags, offered as one-tap
 * add chips in the tag editor (Version 3). Never hardcoded as the only
 * options — the performer can still create any tag they like.
 */
export const SUGGESTED_TAGS = [
  'Guitar Solo',
  'Duet',
  'Instrumental',
  'Dance',
  'Audience Favourite',
  'Singalong',
  'Opener',
  'Encore',
  'Christmas',
  'Requests',
];

/**
 * A song's place in the working repertoire. Replaces Version 1/2's separate
 * `SongStatus` (workflow stage) and `PerformanceFrequency` (Quick Assessment
 * answer) — those were two status concepts that never merged, which is why
 * Version 2's statistics looked wrong. There is now exactly one status per
 * song. "Unexplored" is the default for a song with no rating at all — it
 * means "not yet in rotation", not "bad".
 */
export type RepertoireStatus = 'regular' | 'occasional' | 'learning' | 'unexplored';

export const REPERTOIRE_STATUSES: RepertoireStatus[] = [
  'regular',
  'occasional',
  'learning',
  'unexplored',
];

export const REPERTOIRE_STATUS_LABELS: Record<RepertoireStatus, string> = {
  regular: '🎤 Regular',
  occasional: '🎵 Occasional',
  learning: '📚 Learning',
  unexplored: '🌱 Unexplored',
};

/** Regular is the highest priority, Unexplored the lowest — used to order status breakdowns. */
export const REPERTOIRE_STATUS_PRIORITY: Record<RepertoireStatus, number> = {
  regular: 4,
  occasional: 3,
  learning: 2,
  unexplored: 1,
};

/**
 * A rating is one row per song, holding the musician's own self-assessment.
 * Demand/Reliability/Enjoyment/Fatigue are all on the 1-5 scale above, and
 * are nullable: Version 3's two-stage assessment (Constitution Priority 5)
 * rates Demand+Reliability in Pass One and Enjoyment+Fatigue in Pass Two,
 * so a song can legitimately have some of these set and others not yet —
 * `null` means "not yet rated in that pass", distinct from any real 1-5
 * value. Transpose is in semitones and may be negative.
 */
export interface Rating {
  songId: string; // primary key, references songs.id
  demand: RatingValue | null; // overall audience/setlist demand — Pass One
  reliability: RatingValue | null; // how reliably the performer nails it — Pass One
  enjoyment: RatingValue | null; // how much they enjoy performing it — Pass Two
  fatigue: RatingValue | null; // how vocally tiring it is — Pass Two
  transpose: number; // semitones, e.g. -12..+12
  status: RepertoireStatus;
  notes: string;
  ratedAt: string; // ISO timestamp of the most recent save

  // --- Reserved for future features (see Constitution Feature 9). Not
  // populated or editable by any screen yet. ---
  audienceRating?: number | null;
  guitarDifficulty?: number | null;
  soloDifficulty?: number | null;
  performanceNotes?: string | null;
}

/**
 * Reserved for future manually-entered voice data (range, tessitura, etc.).
 * Not populated or read in Version 1 — the Voice Profile dashboard computes
 * its view live from Rating + Song data instead of relying on this table.
 */
export interface VoiceProfileEntry {
  id: string;
  songId: string;
  createdAt: string;
}

export type EntityType = 'song' | 'artist' | 'folder' | 'track' | 'playlist';

/** Maps an external record (e.g. a StageTraxx song id) to VocalDNA's internal UUID. */
export interface ExternalIdMapping {
  entityType: EntityType;
  sourceSystem: string; // 'stagetraxx', later 'onsong', 'musicxml', ...
  sourceId: string;
  internalId: string;
}

export interface ImportLogEntry {
  id?: number; // auto-increment
  sourceSystem: string;
  sourceFileName: string;
  startedAt: string;
  finishedAt: string;
  songsInserted: number;
  songsUpdated: number;
  songsMatchedByNameFallback: number; // matched by artist+title, not StageTraxx id — see Priority 7/8
  artistsInserted: number;
  foldersInserted: number;
  playlistsInserted: number;
  playlistItemsInserted: number;
}

export interface Setting {
  key: string;
  value: string;
}

// --- `keywords`/`songKeywords` (Tags) and `playlists`/`playlistItems` were
// reserved in Version 1, table names unchanged since. Tags became active in
// Version 2; Playlists become active in Version 2.1, imported directly from
// StageTraxx (see import/st4bImporter.ts) rather than user-created. ---

export interface Playlist {
  id: string; // VocalDNA-owned UUID
  name: string;
}

export interface PlaylistItem {
  id: string; // VocalDNA-owned UUID
  playlistId: string;
  songId: string;
  position: number;
}

/** A user-created tag (e.g. "Crowd Pleaser", "Waltz", "Country"). Free-form — never hardcoded. */
export interface Keyword {
  id: string;
  name: string;
}

export interface SongKeyword {
  songId: string;
  keywordId: string;
}

/**
 * Reserved for future per-gig performance logging (see Constitution
 * Feature 9). Not populated or read by any Version 2 screen.
 */
export interface PerformanceHistoryEntry {
  id: string;
  songId: string;
  createdAt: string;
}

/**
 * Fallback values for any write path that can create a brand-new rating row
 * (Quick Assessment, Batch Actions) before every field has been explicitly
 * set by the performer. Demand/Reliability/Enjoyment/Fatigue start `null` —
 * not a placeholder number — so Pass One/Pass Two can tell "not yet rated"
 * from "rated but happens to be low".
 */
export function createDefaultRating(songId: string): Rating {
  return {
    songId,
    demand: null,
    reliability: null,
    enjoyment: null,
    fatigue: null,
    transpose: 0,
    status: 'unexplored',
    notes: '',
    ratedAt: new Date().toISOString(),
  };
}
