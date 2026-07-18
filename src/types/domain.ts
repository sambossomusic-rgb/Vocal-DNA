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
 * Demand/Reliability/Enjoyment/Fatigue are all 1-10. Transpose is in
 * semitones and may be negative.
 */
export interface Rating {
  songId: string; // primary key, references songs.id
  demand: number; // 1-10, overall audience/setlist demand
  reliability: number; // 1-10, how reliably the performer nails it
  enjoyment: number; // 1-10, how much they enjoy performing it
  fatigue: number; // 1-10, how vocally tiring it is
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
  artistsInserted: number;
  foldersInserted: number;
  tracksInserted: number;
  tracksUpdated: number;
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
 * set by the performer.
 */
export function createDefaultRating(songId: string): Rating {
  return {
    songId,
    demand: 5,
    reliability: 5,
    enjoyment: 5,
    fatigue: 5,
    transpose: 0,
    status: 'unexplored',
    notes: '',
    ratedAt: new Date().toISOString(),
  };
}
