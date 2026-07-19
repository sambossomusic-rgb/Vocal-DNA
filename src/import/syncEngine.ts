import JSZip from 'jszip';
import { db } from '../db/db';
import { resolveInternalId, recordExternalId } from './idMapper';
import type { ImportLogEntry } from '../types/domain';

const SOURCE_SYSTEM = 'stagetraxx';

// --- Source shapes as they appear in backup_data.json. Songs/folders were
// confirmed against a real export; playlists/keywords use defensive field
// fallbacks (their exact shape hasn't been confirmed), and the sync summary
// surfaces the counts so a wrong guess is visible rather than silent. ---

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
}
interface St4bFolder {
  id: string;
  name: string;
}
interface St4bPlaylist {
  id: string;
  name?: string;
}
interface St4bPlaylistSong {
  playlistID?: string;
  playlistId?: string;
  songID?: string;
  songId?: string;
  position?: number;
  order?: number;
}
interface St4bKeyword {
  id?: string;
  name?: string;
}
interface St4bSongKeyword {
  songID?: string;
  songId?: string;
  keywordID?: string;
  keywordId?: string;
}
export interface St4bBackup {
  songs?: St4bSong[];
  folders?: St4bFolder[];
  playlists?: St4bPlaylist[];
  playlistSongs?: St4bPlaylistSong[];
  keywords?: St4bKeyword[];
  songKeywords?: St4bSongKeyword[];
  tracks?: unknown[];
  regions?: unknown[];
}

/**
 * What a sync would change, per selectable category (V4 items 7/8). Produced
 * WITHOUT writing anything, so the wizard can preview before applying.
 * VocalDNA assessment data (ratings, status, notes, tags, assessment history)
 * is never in this plan — the sync engine simply never touches those tables.
 */
export interface SyncPlan {
  totalSourceSongs: number;
  newSongs: Array<{ title: string; artist: string }>;
  matchedByName: number; // existing songs matched by artist+title, not StageTraxx id
  updates: {
    title: number;
    artist: number;
    folder: number;
    key: number;
    bpm: number;
    playCount: number;
  };
  newFolders: number;
  newPlaylists: number;
  newPlaylistLinks: number;
  newKeywords: number;
  newSongKeywordLinks: number;
  removedSongs: Array<{ title: string; artist: string }>; // in VocalDNA, absent from this file — never deleted
}

export interface SyncOptions {
  newSongs: boolean;
  metadata: boolean; // title + artist on existing songs
  keys: boolean;
  bpm: boolean;
  folders: boolean; // folder assignment + create missing folders
  playlists: boolean;
  keywords: boolean; // StageTraxx keywords added as tags (additive; never removes your tags)
  playCounts: boolean;
}

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  newSongs: true,
  metadata: true,
  keys: false, // OFF by default — protects keys you've changed inside VocalDNA
  bpm: true,
  folders: true,
  playlists: true,
  keywords: true,
  playCounts: true,
};

export interface SyncSummary {
  songsInserted: number;
  songsUpdated: number;
  foldersInserted: number;
  playlistsInserted: number;
  playlistLinksInserted: number;
  keywordsInserted: number;
  songKeywordLinksInserted: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Reads the .st4b zip (browser File, read-only) and returns its parsed backup JSON. */
export async function parseBackup(file: File): Promise<St4bBackup> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('backup_data.json');
  if (!entry) throw new Error('This .st4b file does not contain a backup_data.json entry.');
  return JSON.parse(await entry.async('string')) as St4bBackup;
}

// Resolves a source song to an existing VocalDNA song id WITHOUT writing —
// by StageTraxx id first, then by artist + normalized title. Returns null if
// it's genuinely new.
async function resolveExistingSongId(
  song: St4bSong,
  existingArtistIdByName: Map<string, string>
): Promise<string | null> {
  const bySourceId = await db.externalIds.get(['song', SOURCE_SYSTEM, song.id]);
  if (bySourceId) return bySourceId.internalId;

  const artistId = song.artist ? existingArtistIdByName.get(normalize(song.artist)) : undefined;
  if (!artistId) return null;
  const normalizedTitle = normalize(song.title);
  const match = await db.songs
    .where('artistId')
    .equals(artistId)
    .filter((s) => normalize(s.title) === normalizedTitle)
    .first();
  return match?.id ?? null;
}

/** Computes what a sync would change — reads only, writes nothing. */
export async function analyzeSync(backup: St4bBackup): Promise<SyncPlan> {
  const sourceSongs = backup.songs ?? [];

  const existingArtists = await db.artists.toArray();
  const existingArtistIdByName = new Map(existingArtists.map((a) => [a.nameNormalized, a.id]));
  const existingFolders = await db.folders.toArray();
  const existingFolderSourceIds = new Set(
    (await db.externalIds.toArray())
      .filter((e) => e.entityType === 'folder' && e.sourceSystem === SOURCE_SYSTEM)
      .map((e) => e.sourceId)
  );

  const plan: SyncPlan = {
    totalSourceSongs: sourceSongs.length,
    newSongs: [],
    matchedByName: 0,
    updates: { title: 0, artist: 0, folder: 0, key: 0, bpm: 0, playCount: 0 },
    newFolders: 0,
    newPlaylists: 0,
    newPlaylistLinks: 0,
    newKeywords: 0,
    newSongKeywordLinks: 0,
    removedSongs: [],
  };

  const seenSourceSongIds = new Set<string>();
  for (const song of sourceSongs) {
    seenSourceSongIds.add(song.id);
    const bySourceId = await db.externalIds.get(['song', SOURCE_SYSTEM, song.id]);
    const existingId = await resolveExistingSongId(song, existingArtistIdByName);

    if (!existingId) {
      plan.newSongs.push({ title: song.title, artist: song.artist ?? 'Unknown artist' });
      continue;
    }
    if (!bySourceId) plan.matchedByName += 1;

    const existing = await db.songs.get(existingId);
    if (!existing) continue;
    if (song.title !== existing.title) plan.updates.title += 1;
    const sourceArtistId = song.artist ? existingArtistIdByName.get(normalize(song.artist)) ?? null : null;
    if (song.artist && sourceArtistId !== existing.artistId) plan.updates.artist += 1;
    if ((song.key?.note ?? null) !== existing.keyNote) plan.updates.key += 1;
    if ((song.bpm ?? null) !== existing.bpm) plan.updates.bpm += 1;
    if ((song.playCount ?? 0) !== existing.playCount) plan.updates.playCount += 1;
    // folder change is counted when the source folder differs
    const sourceFolderExisting = song.folderID
      ? (await db.externalIds.get(['folder', SOURCE_SYSTEM, song.folderID]))?.internalId ?? null
      : null;
    if (song.folderID && sourceFolderExisting !== existing.folderId) plan.updates.folder += 1;
  }

  plan.newFolders = (backup.folders ?? []).filter((f) => !existingFolderSourceIds.has(f.id)).length;

  const existingPlaylistSourceIds = new Set(
    (await db.externalIds.toArray())
      .filter((e) => e.entityType === 'playlist' && e.sourceSystem === SOURCE_SYSTEM)
      .map((e) => e.sourceId)
  );
  plan.newPlaylists = (backup.playlists ?? []).filter((p) => !existingPlaylistSourceIds.has(p.id)).length;
  plan.newPlaylistLinks = (backup.playlistSongs ?? []).length; // upper bound; links to unknown songs skip at apply

  const existingKeywordNames = new Set((await db.keywords.toArray()).map((k) => normalize(k.name)));
  plan.newKeywords = (backup.keywords ?? []).filter(
    (k) => k.name && !existingKeywordNames.has(normalize(k.name))
  ).length;
  plan.newSongKeywordLinks = (backup.songKeywords ?? []).length; // upper bound

  // Removed: previously imported from this source, absent from this file.
  const priorSongMappings = (await db.externalIds.toArray()).filter(
    (e) => e.entityType === 'song' && e.sourceSystem === SOURCE_SYSTEM
  );
  for (const mapping of priorSongMappings) {
    if (seenSourceSongIds.has(mapping.sourceId)) continue;
    const song = await db.songs.get(mapping.internalId);
    if (!song) continue;
    const artist = song.artistId ? await db.artists.get(song.artistId) : undefined;
    plan.removedSongs.push({ title: song.title, artist: artist?.name ?? 'Unknown artist' });
  }

  // suppress unused-var lint for existingFolders (kept for readability/future use)
  void existingFolders;
  return plan;
}

/**
 * Applies only the selected categories. NEVER writes to ratings,
 * assessmentHistory, songKeywords-that-users-created removal, etc. — VocalDNA
 * assessments are structurally out of reach here (this function only writes
 * to songs / artists / folders / playlists / playlistItems / keywords /
 * songKeywords, and only additively for keywords).
 */
export async function applySync(
  backup: St4bBackup,
  options: SyncOptions,
  file: { name: string }
): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const summary: SyncSummary = {
    songsInserted: 0,
    songsUpdated: 0,
    foldersInserted: 0,
    playlistsInserted: 0,
    playlistLinksInserted: 0,
    keywordsInserted: 0,
    songKeywordLinksInserted: 0,
  };

  async function upsertArtist(rawName: string | undefined): Promise<string | null> {
    const trimmed = rawName?.trim();
    if (!trimmed) return null;
    const normalized = normalize(trimmed);
    const existing = await db.artists.where('nameNormalized').equals(normalized).first();
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    await db.artists.add({ id, name: trimmed, nameNormalized: normalized });
    return id;
  }

  await db.transaction(
    'rw',
    [db.songs, db.artists, db.folders, db.playlists, db.playlistItems, db.keywords, db.songKeywords, db.externalIds, db.importLog],
    async () => {
      // Folders (create missing) — needed whenever folders OR new songs are on.
      if (options.folders || options.newSongs) {
        for (const folder of backup.folders ?? []) {
          const { internalId, isNew } = await resolveInternalId(db, 'folder', SOURCE_SYSTEM, folder.id);
          if (isNew) {
            await db.folders.add({ id: internalId, name: folder.name });
            summary.foldersInserted += 1;
          } else if (options.folders) {
            await db.folders.update(internalId, { name: folder.name });
          }
        }
      }

      const artistIdByName = new Map((await db.artists.toArray()).map((a) => [a.nameNormalized, a.id]));

      for (const song of backup.songs ?? []) {
        const bySourceId = await db.externalIds.get(['song', SOURCE_SYSTEM, song.id]);
        let existingId = bySourceId?.internalId ?? null;
        if (!existingId) existingId = await resolveExistingSongId(song, artistIdByName);

        const folderId = song.folderID
          ? (await resolveInternalId(db, 'folder', SOURCE_SYSTEM, song.folderID)).internalId
          : null;

        if (!existingId) {
          if (!options.newSongs) continue;
          const artistId = await upsertArtist(song.artist);
          const { internalId } = await resolveInternalId(db, 'song', SOURCE_SYSTEM, song.id);
          await db.songs.add({
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
            updatedAt: new Date().toISOString(),
          });
          summary.songsInserted += 1;
          continue;
        }

        // Existing song — apply only the selected metadata categories.
        if (!bySourceId) await recordExternalId(db, 'song', SOURCE_SYSTEM, song.id, existingId);
        const patch: Record<string, unknown> = {};
        if (options.metadata) {
          patch.title = song.title;
          patch.artistId = await upsertArtist(song.artist);
        }
        if (options.folders) patch.folderId = folderId;
        if (options.keys) {
          patch.keyNote = song.key?.note ?? null;
          patch.keyAccidental = song.key?.accidental ?? null;
          patch.keyQuality = song.key?.quality ?? null;
        }
        if (options.bpm) patch.bpm = song.bpm ?? null;
        if (options.playCounts) {
          patch.playCount = song.playCount ?? 0;
          patch.lastPlayed = song.lastPlayed ?? null;
        }
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date().toISOString();
          await db.songs.update(existingId, patch);
          summary.songsUpdated += 1;
        }
      }

      if (options.playlists) {
        for (const playlist of backup.playlists ?? []) {
          const { internalId, isNew } = await resolveInternalId(db, 'playlist', SOURCE_SYSTEM, playlist.id);
          const name = playlist.name?.trim() || 'Untitled playlist';
          if (isNew) {
            await db.playlists.add({ id: internalId, name });
            summary.playlistsInserted += 1;
          } else {
            await db.playlists.update(internalId, { name });
          }
        }
        for (const link of backup.playlistSongs ?? []) {
          const sPlaylist = link.playlistID ?? link.playlistId;
          const sSong = link.songID ?? link.songId;
          if (!sPlaylist || !sSong) continue;
          const playlistInternal = (await db.externalIds.get(['playlist', SOURCE_SYSTEM, sPlaylist]))?.internalId;
          const songInternal = (await db.externalIds.get(['song', SOURCE_SYSTEM, sSong]))?.internalId;
          if (!playlistInternal || !songInternal) continue;
          const id = `${playlistInternal}:${songInternal}`;
          const existing = await db.playlistItems.get(id);
          await db.playlistItems.put({
            id,
            playlistId: playlistInternal,
            songId: songInternal,
            position: link.position ?? link.order ?? 0,
          });
          if (!existing) summary.playlistLinksInserted += 1;
        }
      }

      if (options.keywords) {
        // StageTraxx keywords become VocalDNA tags — additive only, so a user's
        // own tags are never removed.
        const keywordInternalBySourceId = new Map<string, string>();
        for (const kw of backup.keywords ?? []) {
          if (!kw.id || !kw.name?.trim()) continue;
          const name = kw.name.trim();
          const existing = await db.keywords.where('name').equals(name).first();
          const id = existing?.id ?? crypto.randomUUID();
          if (!existing) {
            await db.keywords.add({ id, name });
            summary.keywordsInserted += 1;
          }
          keywordInternalBySourceId.set(kw.id, id);
        }
        for (const link of backup.songKeywords ?? []) {
          const sSong = link.songID ?? link.songId;
          const sKeyword = link.keywordID ?? link.keywordId;
          if (!sSong || !sKeyword) continue;
          const songInternal = (await db.externalIds.get(['song', SOURCE_SYSTEM, sSong]))?.internalId;
          const keywordInternal = keywordInternalBySourceId.get(sKeyword);
          if (!songInternal || !keywordInternal) continue;
          const existing = await db.songKeywords.get([songInternal, keywordInternal]);
          await db.songKeywords.put({ songId: songInternal, keywordId: keywordInternal });
          if (!existing) summary.songKeywordLinksInserted += 1;
        }
      }

      const logEntry: ImportLogEntry = {
        sourceSystem: SOURCE_SYSTEM,
        sourceFileName: file.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        songsInserted: summary.songsInserted,
        songsUpdated: summary.songsUpdated,
        songsMatchedByNameFallback: 0,
        artistsInserted: 0,
        foldersInserted: summary.foldersInserted,
        playlistsInserted: summary.playlistsInserted,
        playlistItemsInserted: summary.playlistLinksInserted,
      };
      await db.importLog.add(logEntry);
    }
  );

  return summary;
}
