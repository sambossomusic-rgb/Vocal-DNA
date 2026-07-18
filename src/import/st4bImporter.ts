import JSZip from 'jszip';
import { db } from '../db/db';
import { resolveInternalId, findInternalId, recordExternalId } from './idMapper';
import type { ImportLogEntry } from '../types/domain';

const SOURCE_SYSTEM = 'stagetraxx';

// --- Shapes of the data as they actually appear in backup_data.json ---
// (Confirmed by inspecting a real .st4b export. This importer only ever
// reads a File the user explicitly selected via a file picker — browser
// File objects have no write API, so the original file cannot be modified
// by this code even in principle.)

interface St4bKey {
  note?: string;
  accidental?: number;
  quality?: number;
}

interface St4bSong {
  id: string;
  title: string;
  artist?: string;
  year?: number;
  bpm?: number;
  duration?: number;
  key?: St4bKey;
  folderID?: string;
  lyrics?: string;
  notes?: string;
  playCount?: number;
  lastPlayed?: string;
  added?: string;
  lastModified?: string;
}

interface St4bFolder {
  id: string;
  name: string;
}

interface St4bPlaylist {
  id: string;
  name?: string;
}

// Field names guessed defensively (playlistID/songID matching the songID
// convention this source uses elsewhere) since this shape hasn't been
// confirmed against a real .st4b export the way songs/folders have.
// playlistsInserted/playlistItemsInserted in the import summary make it
// obvious if this guess is wrong (they'd read 0 despite playlists existing
// in the source).
interface St4bPlaylistSong {
  id?: string;
  playlistID?: string;
  playlistId?: string;
  songID?: string;
  songId?: string;
  position?: number;
  order?: number;
}

interface St4bBackup {
  songs?: St4bSong[];
  folders?: St4bFolder[];
  playlists?: St4bPlaylist[];
  playlistSongs?: St4bPlaylistSong[];
  tracks?: unknown[]; // no longer imported (Constitution Priority 3) — counted only
  keywords?: unknown[];
  songKeywords?: unknown[];
  regions?: unknown[];
  metadata?: unknown;
}

export interface ImportSummary {
  sourceFileName: string;
  tablesFoundInSource: Record<string, number>;
  songsInserted: number;
  songsUpdated: number;
  artistsInserted: number;
  foldersInserted: number;
  playlistsInserted: number;
  playlistItemsInserted: number;
  // Songs matched to an existing VocalDNA record by artist+title rather than
  // by StageTraxx id (Constitution Priority 7/8) — the riskiest matches,
  // worth a human glance ("potential conflicts").
  matchedByNameFallback: Array<{ title: string; artistName: string }>;
  // Songs previously imported from this source but absent from this file.
  // Report-only: never auto-deleted, since a filtered/partial export
  // shouldn't erase a song's ratings/tags/history.
  removedSongs: Array<{ title: string; artistName: string }>;
  duplicateTitleGroups: Array<{ title: string; count: number }>;
  missingMetadataCount: number;
}

/**
 * Reads a StageTraxx4 .st4b file (selected via a browser file input) and
 * merges its songs, artists, folders, and playlists into VocalDNA's
 * IndexedDB database.
 *
 * Read-only guarantee: `file` is a browser File object, which only exposes
 * read methods (arrayBuffer/text/stream). JSZip is used purely to read the
 * archive into memory; nothing here ever calls a save/write API against the
 * original file or its path.
 *
 * Merge guarantee (Constitution Priority 7): every song is matched first by
 * StageTraxx id, then — if that id is new — by artist+title, so a StageTraxx
 * id changing between exports doesn't create a duplicate record. Ratings,
 * notes-on-a-rating, status, tags, transpose, and performance history all
 * live in separate tables this importer never touches, so re-importing can
 * never erase an assessment — only a song's own metadata (title, artist,
 * folder, key, tempo) is ever overwritten.
 */
export async function importSt4b(file: File): Promise<ImportSummary> {
  const startedAt = new Date().toISOString();

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('backup_data.json');
  if (!entry) {
    throw new Error('This .st4b file does not contain a backup_data.json entry.');
  }
  const json = await entry.async('string');
  const backup: St4bBackup = JSON.parse(json);

  const tablesFoundInSource: Record<string, number> = {
    songs: backup.songs?.length ?? 0,
    folders: backup.folders?.length ?? 0,
    playlists: backup.playlists?.length ?? 0,
    playlistSongs: backup.playlistSongs?.length ?? 0,
    keywords: backup.keywords?.length ?? 0,
    songKeywords: backup.songKeywords?.length ?? 0,
    regions: backup.regions?.length ?? 0,
  };

  const counts = {
    songsInserted: 0,
    songsUpdated: 0,
    artistsInserted: 0,
    foldersInserted: 0,
    playlistsInserted: 0,
    playlistItemsInserted: 0,
  };
  const matchedByNameFallback: Array<{ title: string; artistName: string }> = [];
  const removedSongs: Array<{ title: string; artistName: string }> = [];

  // The whole import runs as a single Dexie transaction: either everything
  // commits, or nothing does, so the database never ends up half-merged.
  await db.transaction(
    'rw',
    [db.songs, db.artists, db.folders, db.playlists, db.playlistItems, db.externalIds, db.importLog],
    async () => {
      // --- Folders ---
      for (const folder of backup.folders ?? []) {
        const { internalId, isNew } = await resolveInternalId(db, 'folder', SOURCE_SYSTEM, folder.id);
        if (isNew) {
          await db.folders.add({ id: internalId, name: folder.name });
          counts.foldersInserted += 1;
        } else {
          await db.folders.update(internalId, { name: folder.name });
        }
      }

      // --- Songs (+ artists, deduplicated by normalized name) ---
      const seenSourceSongIds = new Set<string>();
      for (const song of backup.songs ?? []) {
        seenSourceSongIds.add(song.id);
        const artistId = song.artist ? await upsertArtist(song.artist, counts) : null;
        const folderId = song.folderID
          ? (await resolveInternalId(db, 'folder', SOURCE_SYSTEM, song.folderID)).internalId
          : null;

        const { internalId, isNew } = await resolveSongInternalId(song, artistId, matchedByNameFallback);
        const updatedAt = new Date().toISOString();

        const songRecord = {
          id: internalId,
          title: song.title,
          artistId,
          folderId,
          year: song.year ?? null,
          bpm: song.bpm ?? null,
          duration: song.duration ?? null,
          keyNote: song.key?.note ?? null,
          keyAccidental: song.key?.accidental ?? null,
          keyQuality: song.key?.quality ?? null,
          lyrics: song.lyrics ?? null,
          notes: song.notes ?? null,
          playCount: song.playCount ?? 0,
          lastPlayed: song.lastPlayed ?? null,
          addedAt: song.added ?? null,
          updatedAt,
        };

        if (isNew) {
          await db.songs.add(songRecord);
          counts.songsInserted += 1;
        } else {
          await db.songs.update(internalId, songRecord);
          counts.songsUpdated += 1;
        }
      }

      // --- Removed songs (Priority 8) — report only, never delete, so a
      // filtered/partial StageTraxx export can never silently erase a song's
      // ratings/tags/history just because it's missing from this file. ---
      const priorSongExternalIds = (await db.externalIds.toArray()).filter(
        (e) => e.entityType === 'song' && e.sourceSystem === SOURCE_SYSTEM
      );
      for (const mapping of priorSongExternalIds) {
        if (seenSourceSongIds.has(mapping.sourceId)) continue;
        const song = await db.songs.get(mapping.internalId);
        if (!song) continue;
        const artist = song.artistId ? await db.artists.get(song.artistId) : undefined;
        removedSongs.push({ title: song.title, artistName: artist?.name ?? 'Unknown artist' });
      }

      // --- Playlists (Priority 5 — expose StageTraxx playlists for filtering) ---
      for (const playlist of backup.playlists ?? []) {
        const { internalId, isNew } = await resolveInternalId(db, 'playlist', SOURCE_SYSTEM, playlist.id);
        const name = playlist.name?.trim() || 'Untitled playlist';
        if (isNew) {
          await db.playlists.add({ id: internalId, name });
          counts.playlistsInserted += 1;
        } else {
          await db.playlists.update(internalId, { name });
        }
      }

      // --- Playlist-song links (depend on playlists + songs already resolved above) ---
      for (const link of backup.playlistSongs ?? []) {
        const sourcePlaylistId = link.playlistID ?? link.playlistId;
        const sourceSongId = link.songID ?? link.songId;
        if (!sourcePlaylistId || !sourceSongId) continue;

        const playlistInternalId = await findInternalId(db, 'playlist', SOURCE_SYSTEM, sourcePlaylistId);
        const songInternalId = await findInternalId(db, 'song', SOURCE_SYSTEM, sourceSongId);
        if (!playlistInternalId || !songInternalId) {
          // References a playlist or song outside this import; skip rather
          // than fail the whole import (partial exports can legitimately
          // reference things outside their own scope).
          continue;
        }

        const itemId = `${playlistInternalId}:${songInternalId}`;
        const existing = await db.playlistItems.get(itemId);
        await db.playlistItems.put({
          id: itemId,
          playlistId: playlistInternalId,
          songId: songInternalId,
          position: link.position ?? link.order ?? 0,
        });
        if (!existing) counts.playlistItemsInserted += 1;
      }

      const finishedAt = new Date().toISOString();
      const logEntry: ImportLogEntry = {
        sourceSystem: SOURCE_SYSTEM,
        sourceFileName: file.name,
        startedAt,
        finishedAt,
        songsMatchedByNameFallback: matchedByNameFallback.length,
        ...counts,
      };
      await db.importLog.add(logEntry);
    }
  );

  // --- Post-import reporting (Priority 6/8) — computed fresh across the
  // whole library, not just this import's songs, since that's the number
  // that actually matters for "what needs fixing in StageTraxx now". ---
  const allSongs = await db.songs.toArray();
  const missingMetadataCount = allSongs.filter((s) => !s.keyNote || !s.bpm).length;

  const titleCounts = new Map<string, number>();
  for (const song of allSongs) {
    const normalized = song.title.trim().toLowerCase();
    if (!normalized) continue;
    titleCounts.set(normalized, (titleCounts.get(normalized) ?? 0) + 1);
  }
  const duplicateTitleGroups = [...titleCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);

  return {
    sourceFileName: file.name,
    tablesFoundInSource,
    ...counts,
    matchedByNameFallback,
    removedSongs,
    duplicateTitleGroups,
    missingMetadataCount,
  };
}

/**
 * Resolves a song's internal id, matching first by StageTraxx id and — only
 * if that id has never been seen before — falling back to an existing
 * VocalDNA song with the same artist + normalized title. This is what keeps
 * a StageTraxx id change (which does happen across some export operations)
 * from creating a duplicate record and orphaning the original's ratings.
 */
async function resolveSongInternalId(
  song: St4bSong,
  artistId: string | null,
  matchedByNameFallback: Array<{ title: string; artistName: string }>
): Promise<{ internalId: string; isNew: boolean }> {
  const bySourceId = await resolveInternalId(db, 'song', SOURCE_SYSTEM, song.id);
  if (!bySourceId.isNew) return bySourceId;

  const normalizedTitle = song.title.trim().toLowerCase();
  if (!normalizedTitle || !artistId) return bySourceId;

  const candidate = await db.songs
    .where('artistId')
    .equals(artistId)
    .filter((s) => s.title.trim().toLowerCase() === normalizedTitle)
    .first();
  if (!candidate) return bySourceId;

  // Redirect the mapping resolveInternalId just created (pointing at a
  // freshly minted, never-used id) onto the existing song instead.
  await recordExternalId(db, 'song', SOURCE_SYSTEM, song.id, candidate.id);
  const artist = await db.artists.get(artistId);
  matchedByNameFallback.push({ title: song.title, artistName: artist?.name ?? 'Unknown artist' });
  return { internalId: candidate.id, isNew: false };
}

/**
 * Finds an existing artist by normalized name, or creates one. Artists are
 * matched by name (StageTraxx has no artist entity/id of its own), so
 * re-imports naturally reuse the same artist row rather than duplicating it.
 */
async function upsertArtist(
  rawName: string,
  counts: { artistsInserted: number }
): Promise<string | null> {
  const trimmed = rawName.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();

  const existing = await db.artists.where('nameNormalized').equals(normalized).first();
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  await db.artists.add({ id, name: trimmed, nameNormalized: normalized });
  counts.artistsInserted += 1;
  return id;
}
