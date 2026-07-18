import JSZip from 'jszip';
import { db } from '../db/db';
import { resolveInternalId, findInternalId } from './idMapper';
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

interface St4bTrack {
  id: string;
  songID: string;
  number?: number;
  name?: string;
  filePath?: string;
  duration?: number;
  volume?: number;
  mute?: boolean;
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
// convention St4bTrack already uses above) since this shape hasn't been
// confirmed against a real .st4b export the way songs/tracks/folders have.
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
  tracks?: St4bTrack[];
  folders?: St4bFolder[];
  playlists?: St4bPlaylist[];
  playlistSongs?: St4bPlaylistSong[];
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
  tracksInserted: number;
  tracksUpdated: number;
  playlistsInserted: number;
  playlistItemsInserted: number;
}

/**
 * Reads a StageTraxx4 .st4b file (selected via a browser file input) and
 * merges its songs, artists, folders, and tracks into VocalDNA's IndexedDB
 * database.
 *
 * Read-only guarantee: `file` is a browser File object, which only exposes
 * read methods (arrayBuffer/text/stream). JSZip is used purely to read the
 * archive into memory; nothing here ever calls a save/write API against the
 * original file or its path.
 *
 * Repeat-import guarantee: every song/artist/folder/track is matched against
 * `externalIds` first. If a matching StageTraxx id was seen in a previous
 * import, the existing VocalDNA row is updated in place. Only genuinely new
 * records get a new internal UUID and a new row.
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
    tracks: backup.tracks?.length ?? 0,
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
    tracksInserted: 0,
    tracksUpdated: 0,
    playlistsInserted: 0,
    playlistItemsInserted: 0,
  };

  // The whole import runs as a single Dexie transaction: either everything
  // commits, or nothing does, so the database never ends up half-merged.
  await db.transaction(
    'rw',
    [
      db.songs,
      db.artists,
      db.folders,
      db.tracks,
      db.playlists,
      db.playlistItems,
      db.externalIds,
      db.importLog,
    ],
    async () => {
      // --- Folders ---
      for (const folder of backup.folders ?? []) {
        const { internalId, isNew } = await resolveInternalId(
          db,
          'folder',
          SOURCE_SYSTEM,
          folder.id
        );
        if (isNew) {
          await db.folders.add({ id: internalId, name: folder.name });
          counts.foldersInserted += 1;
        } else {
          await db.folders.update(internalId, { name: folder.name });
        }
      }

      // --- Songs (+ artists, deduplicated by normalized name) ---
      for (const song of backup.songs ?? []) {
        const artistId = song.artist ? await upsertArtist(song.artist, counts) : null;
        const folderId = song.folderID
          ? (await resolveInternalId(db, 'folder', SOURCE_SYSTEM, song.folderID)).internalId
          : null;

        const { internalId, isNew } = await resolveInternalId(
          db,
          'song',
          SOURCE_SYSTEM,
          song.id
        );
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

      // --- Tracks (depend on songs already being resolved above) ---
      for (const track of backup.tracks ?? []) {
        const songInternalId = await findInternalId(db, 'song', SOURCE_SYSTEM, track.songID);
        if (!songInternalId) {
          // Track references a song that wasn't in this import; skip rather
          // than fail the whole import, since this can legitimately happen
          // with partial exports.
          continue;
        }

        const { internalId, isNew } = await resolveInternalId(
          db,
          'track',
          SOURCE_SYSTEM,
          track.id
        );

        const trackRecord = {
          id: internalId,
          songId: songInternalId,
          number: track.number ?? null,
          name: track.name ?? null,
          filePath: track.filePath ?? null,
          duration: track.duration ?? null,
          volume: track.volume ?? null,
          muted: Boolean(track.mute),
        };

        if (isNew) {
          await db.tracks.add(trackRecord);
          counts.tracksInserted += 1;
        } else {
          await db.tracks.update(internalId, trackRecord);
          counts.tracksUpdated += 1;
        }
      }

      // --- Playlists (Priority 5 — expose StageTraxx playlists for filtering) ---
      for (const playlist of backup.playlists ?? []) {
        const { internalId, isNew } = await resolveInternalId(
          db,
          'playlist',
          SOURCE_SYSTEM,
          playlist.id
        );
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
          // than fail the whole import (same reasoning as tracks above).
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
        ...counts,
      };
      await db.importLog.add(logEntry);
    }
  );

  return {
    sourceFileName: file.name,
    tablesFoundInSource,
    ...counts,
  };
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
