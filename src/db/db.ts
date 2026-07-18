import Dexie, { type Table } from 'dexie';
import type {
  Artist,
  Folder,
  Song,
  Track,
  Rating,
  ExternalIdMapping,
  ImportLogEntry,
  Setting,
  Playlist,
  PlaylistItem,
  Keyword,
  SongKeyword,
  VoiceProfileEntry,
  PerformanceHistoryEntry,
} from '../types/domain';

/**
 * VocalDNA's own IndexedDB database. Table names and shapes are the
 * application's own domain model — nothing here mirrors StageTraxx's
 * internal structure. This is a completely separate store from the
 * original .st4b file, which is never opened for writing anywhere in
 * this app (browser file inputs are read-only handles by construction).
 *
 * `externalIds` is what allows repeat imports (from StageTraxx now, and
 * potentially OnSong/MusicXML/ChordPro later) to update existing rows
 * instead of creating duplicates — see src/import/idMapper.ts.
 */
export class VocalDnaDatabase extends Dexie {
  songs!: Table<Song, string>;
  artists!: Table<Artist, string>;
  folders!: Table<Folder, string>;
  tracks!: Table<Track, string>;
  ratings!: Table<Rating, string>;
  externalIds!: Table<ExternalIdMapping, [string, string, string]>;
  importLog!: Table<ImportLogEntry, number>;
  settings!: Table<Setting, string>;

  // `keywords`/`songKeywords` were reserved in Version 1 and are now the
  // Version 2 Tag system (see types/domain.ts). `playlists`/`playlistItems`
  // and `voiceProfileEntries` remain reserved and unused.
  playlists!: Table<Playlist, string>;
  playlistItems!: Table<PlaylistItem, string>;
  keywords!: Table<Keyword, string>;
  songKeywords!: Table<SongKeyword, [string, string]>;
  voiceProfileEntries!: Table<VoiceProfileEntry, string>;

  // Reserved for a future performance-history feature — created now so the
  // schema is stable, populated by nothing in Version 2.
  performanceHistory!: Table<PerformanceHistoryEntry, string>;

  constructor() {
    super('vocaldna');

    this.version(1).stores({
      songs: 'id, artistId, folderId, title, year, keyNote',
      artists: 'id, nameNormalized',
      folders: 'id, name',
      tracks: 'id, songId',
      ratings: 'songId, status, ratedAt',
      externalIds: '[entityType+sourceSystem+sourceId], internalId',
      importLog: '++id, startedAt',
      settings: 'key',
      playlists: 'id, name',
      playlistItems: 'id, playlistId, songId',
      keywords: 'id, name',
      songKeywords: '[songId+keywordId], songId, keywordId',
      voiceProfileEntries: 'id, songId',
    });

    // Version 2 only adds the reserved performanceHistory table — every
    // other table/index from Version 1 is carried forward unchanged.
    this.version(2).stores({
      performanceHistory: 'id, songId',
    });
  }
}

export const db = new VocalDnaDatabase();
