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

  // --- Reserved for future features (see Constitution Feature 9). Not
  // populated or editable by any screen yet. ---
  capo?: number | null;
  alternateTuning?: string | null;
}

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

export type SongStatus = 'new' | 'learning' | 'ready' | 'performance-ready' | 'retired';

export const SONG_STATUSES: SongStatus[] = [
  'new',
  'learning',
  'ready',
  'performance-ready',
  'retired',
];

/**
 * Version 2's Quick Assessment answer: how often the performer currently
 * plays this song. Distinct from `SongStatus` above (a workflow stage set
 * via the detailed rating form) — this is the fast, one-tap signal used to
 * drive the assessment queue, adaptive defaults, and predictions.
 */
export type PerformanceFrequency = 'regular' | 'occasional' | 'learning' | 'never';

export const PERFORMANCE_FREQUENCIES: PerformanceFrequency[] = [
  'regular',
  'occasional',
  'learning',
  'never',
];

/**
 * A rating is one row per song, holding the musician's own self-assessment.
 * All numeric scales are 1-5. Transpose is in semitones and may be negative.
 */
export interface Rating {
  songId: string; // primary key, references songs.id
  difficulty: number; // 1-5, how hard the song is to perform
  confidence: number; // 1-5, how confident the singer feels
  enjoyment: number; // 1-5, how much they enjoy performing it
  fatigue: number; // 1-5, how vocally tiring it is
  transpose: number; // semitones, e.g. -12..+12
  status: SongStatus;
  notes: string;
  ratedAt: string; // ISO timestamp of the most recent save

  // --- Version 2: Quick Assessment fields. Optional so every Version 1 row
  // (which never set these) keeps loading and saving without a migration. ---
  performanceFrequency?: PerformanceFrequency | null;
  demand?: number | null; // 1-10, overall audience/setlist demand
  reliability?: number | null; // 1-10, how reliably the performer nails it

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

export type EntityType = 'song' | 'artist' | 'folder' | 'track';

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
  artistsInserted: number;
  foldersInserted: number;
  tracksInserted: number;
  tracksUpdated: number;
}

export interface Setting {
  key: string;
  value: string;
}

// --- Reserved schema, not used in Version 1. `Keyword`/`SongKeyword` are
// now used starting in Version 2 as VocalDNA's free-form Tag system (see
// Constitution Feature 7) — table names are unchanged to avoid an
// unnecessary database rename, but every Version 2+ screen presents them
// to the performer as "Tags". `Playlist`/`PlaylistItem` remain reserved. ---

export interface Playlist {
  id: string;
  name: string;
}

export interface PlaylistItem {
  id: string;
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
 * The Version 1 rating defaults, factored out so every Version 2 write path
 * that can create a brand-new rating row (Quick Assessment, Batch Actions)
 * fills the untouched Version 1 fields the same way the detailed Rating
 * Form always has, instead of leaving them undefined.
 */
export function createDefaultRating(songId: string): Rating {
  return {
    songId,
    difficulty: 3,
    confidence: 3,
    enjoyment: 3,
    fatigue: 3,
    transpose: 0,
    status: 'new',
    notes: '',
    ratedAt: new Date().toISOString(),
  };
}
