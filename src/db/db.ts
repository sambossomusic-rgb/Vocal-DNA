import Dexie, { type Table } from 'dexie';
import type {
  Artist,
  Folder,
  Song,
  Track,
  Rating,
  RepertoireStatus,
  RatingValue,
  AssessmentHistoryEntry,
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

// Version 1/2 shape, before Version 2.1 consolidated it — only used to type
// the upgrade function's input, never imported elsewhere.
interface LegacyRatingRow {
  difficulty?: number;
  confidence?: number;
  enjoyment?: number;
  fatigue?: number;
  status?: string;
  performanceFrequency?: string;
  demand?: number;
  reliability?: number;
}

// Version 1's 1-5 scale mapped onto Version 2.1's 1-10 scale. Not a
// "correct" conversion — there isn't one — just a reasonable, deterministic
// spread so existing ratings remain meaningfully ordered after the upgrade.
function scaleFiveToTen(value: number): number {
  return Math.round(1 + ((value - 1) * 9) / 4);
}

// Version 2.1's 1-10 scale bucketed back down onto Version 3's 1-5 scale
// (Constitution Priority 1) — a clean 2:1 grouping (1-2→1, 3-4→2, ...).
function scaleTenToFive(value: number): RatingValue {
  return Math.ceil(value / 2) as RatingValue;
}

// Prefers Version 2's `performanceFrequency` (a closer match to the new
// status already) and falls back to Version 1's workflow-stage `status`
// for rows that predate Version 2's Quick Assessment entirely.
function migrateStatus(row: LegacyRatingRow): RepertoireStatus {
  switch (row.performanceFrequency) {
    case 'regular':
      return 'regular';
    case 'occasional':
      return 'occasional';
    case 'learning':
      return 'learning';
    case 'never':
      return 'unexplored';
    default:
      break;
  }
  switch (row.status) {
    case 'performance-ready':
      return 'regular';
    case 'ready':
      return 'occasional';
    case 'learning':
      return 'learning';
    default:
      return 'unexplored'; // 'new', 'retired', or anything unrecognized
  }
}

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

  // Version 4 — append-only log of rating snapshots (intelligence prep).
  assessmentHistory!: Table<AssessmentHistoryEntry, string>;

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

    // Version 2.1 consolidates Rating's split fields (difficulty/confidence
    // vs. demand/reliability; workflow-stage status vs. performanceFrequency)
    // into the single shape in types/domain.ts. No index changes — `status`
    // is still just a string field, now with a different set of values — so
    // this version only runs a data migration, no .stores() schema diff.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        // This version's output shape is Version 2.1's own (1-10, non-null)
        // — a distinct intermediate type from today's `Rating`, since
        // Version 3 (below) rescales it again onto the 1-5 nullable shape.
        interface V21RatingRow extends LegacyRatingRow {
          transpose: number;
          status: string;
          notes: string;
          ratedAt: string;
        }
        await tx
          .table('ratings')
          .toCollection()
          .modify((row: V21RatingRow) => {
            const demand = typeof row.demand === 'number' ? row.demand : scaleFiveToTen(row.difficulty ?? 3);
            const reliability =
              typeof row.reliability === 'number' ? row.reliability : scaleFiveToTen(row.confidence ?? 3);

            row.demand = demand;
            row.reliability = reliability;
            row.enjoyment = scaleFiveToTen(row.enjoyment ?? 3);
            row.fatigue = scaleFiveToTen(row.fatigue ?? 3);
            row.status = migrateStatus(row);

            delete row.difficulty;
            delete row.confidence;
            delete row.performanceFrequency;
          });
      });

    // Version 3 (Constitution V3, Priority 1): five-point rating scale
    // replaces the 1-10 scale. Existing rows always have numeric
    // demand/reliability/enjoyment/fatigue at this point (Version 2.1's
    // migration guarantees that), so this is a straight rescale — no
    // nulls to handle yet. New rows created after this point may have
    // null demand/reliability/enjoyment/fatigue (Priority 5's two-pass
    // assessment), which is a TypeScript-level change only, not a schema
    // change — IndexedDB stores whatever shape a row has.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        // Input shape here is Version 2.1's (1-10, non-null) — see the note
        // on version(3) above.
        interface TenPointRatingRow {
          demand: number;
          reliability: number;
          enjoyment: number;
          fatigue: number;
        }
        await tx
          .table('ratings')
          .toCollection()
          .modify((row: TenPointRatingRow) => {
            row.demand = scaleTenToFive(row.demand);
            row.reliability = scaleTenToFive(row.reliability);
            row.enjoyment = scaleTenToFive(row.enjoyment);
            row.fatigue = scaleTenToFive(row.fatigue);
          });
      });

    // Version 4 (app v4) — adds the append-only assessmentHistory table
    // (intelligence prep). Additive only; no existing table/index changes,
    // no data transform.
    this.version(5).stores({
      assessmentHistory: 'id, songId, recordedAt',
    });
  }
}

export const db = new VocalDnaDatabase();
