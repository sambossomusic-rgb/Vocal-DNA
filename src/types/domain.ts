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

// --- Reserved schema, not used in Version 1 (see README / MASTER PLAN) ---

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

export interface Keyword {
  id: string;
  name: string;
}

export interface SongKeyword {
  songId: string;
  keywordId: string;
}
