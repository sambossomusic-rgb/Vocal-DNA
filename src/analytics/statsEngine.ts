import type { Song, Artist, Folder, Rating, RepertoireStatus } from '../types/domain';
import { REPERTOIRE_STATUS_PRIORITY } from '../types/domain';

export interface StatsSnapshot {
  totalSongs: number;
  totalArtists: number;
  totalFolders: number;
  songsPerFolder: Array<{ folderId: string | null; folderName: string; count: number }>;
  keyDistribution: Array<{ key: string; count: number }>;
  averageBpm: number | null;
  ratingCoverage: {
    ratedSongs: number;
    unratedSongs: number;
    percentRated: number;
  };
  averageRatings: {
    demand: number | null;
    reliability: number | null;
    enjoyment: number | null;
    fatigue: number | null;
  };
  statusDistribution: Array<{ status: RepertoireStatus; count: number }>;
  topArtistsBySongCount: Array<{ artistId: string; artistName: string; count: number }>;
  missingMetadata: Array<{
    songId: string;
    title: string;
    artistName: string;
    missingKey: boolean;
    missingBpm: boolean;
  }>;
  // Metadata Health (V4 item 6) — reports for maintaining the StageTraxx
  // library. Every list is of songs (or duplicate-title groups) to fix at the
  // source.
  metadataHealth: {
    missingKey: SongRef[];
    missingBpm: SongRef[];
    missingArtist: SongRef[];
    noFolder: SongRef[];
    duplicateTitles: Array<{ title: string; songIds: string[]; count: number }>;
  };
}

export interface SongRef {
  songId: string;
  title: string;
  artistName: string;
}

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function keyLabel(song: Song): string | null {
  if (!song.keyNote) return null;
  return song.keyNote;
}

/**
 * Computes a full statistics snapshot from raw data. This function has no
 * dependency on Dexie, React, or any UI framework — it takes plain arrays in
 * and returns a plain object out, so it can be unit tested or reused by a
 * future export/report feature without touching the UI layer at all.
 */
export function computeStats(
  songs: Song[],
  artists: Artist[],
  folders: Folder[],
  ratings: Rating[]
): StatsSnapshot {
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));
  const artistNameById = new Map(artists.map((a) => [a.id, a.name]));
  const ratingBySongId = new Map(ratings.map((r) => [r.songId, r]));

  // Songs per folder
  const folderCounts = new Map<string | null, number>();
  for (const song of songs) {
    folderCounts.set(song.folderId, (folderCounts.get(song.folderId) ?? 0) + 1);
  }
  const songsPerFolder = [...folderCounts.entries()]
    .map(([folderId, count]) => ({
      folderId,
      folderName: folderId ? folderNameById.get(folderId) ?? 'Unknown folder' : 'No folder',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Key distribution
  const keyCounts = new Map<string, number>();
  for (const song of songs) {
    const label = keyLabel(song);
    if (!label) continue;
    keyCounts.set(label, (keyCounts.get(label) ?? 0) + 1);
  }
  const keyDistribution = NOTE_LABELS.filter((n) => keyCounts.has(n))
    .map((key) => ({ key, count: keyCounts.get(key)! }))
    .concat(
      [...keyCounts.entries()]
        .filter(([k]) => !NOTE_LABELS.includes(k))
        .map(([key, count]) => ({ key, count }))
    );

  // Average BPM (only over songs that have one)
  const bpms = songs.map((s) => s.bpm).filter((b): b is number => typeof b === 'number' && b > 0);
  const averageBpm = bpms.length > 0 ? bpms.reduce((a, b) => a + b, 0) / bpms.length : null;

  // Rating coverage
  const ratedSongs = songs.filter((s) => ratingBySongId.has(s.id)).length;
  const unratedSongs = songs.length - ratedSongs;
  const percentRated = songs.length > 0 ? (ratedSongs / songs.length) * 100 : 0;

  // Average rating dimensions — only across ratings where that specific
  // field has actually been set (Version 3's two-pass assessment means
  // Demand/Reliability and Enjoyment/Fatigue can each be null independently).
  const avg = (selector: (r: Rating) => number | null): number | null => {
    const values = ratings.map(selector).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  // Status distribution — ordered by repertoire priority (Regular first),
  // not by count, per the Constitution's status weighting.
  const statusCounts = new Map<RepertoireStatus, number>();
  for (const rating of ratings) {
    statusCounts.set(rating.status, (statusCounts.get(rating.status) ?? 0) + 1);
  }
  const statusDistribution = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => REPERTOIRE_STATUS_PRIORITY[b.status] - REPERTOIRE_STATUS_PRIORITY[a.status]);

  // Top artists by song count
  const artistCounts = new Map<string, number>();
  for (const song of songs) {
    if (!song.artistId) continue;
    artistCounts.set(song.artistId, (artistCounts.get(song.artistId) ?? 0) + 1);
  }
  const topArtistsBySongCount = [...artistCounts.entries()]
    .map(([artistId, count]) => ({ artistId, artistName: artistNameById.get(artistId) ?? 'Unknown artist', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const songArtistName = (s: Song): string =>
    s.artistId ? artistNameById.get(s.artistId) ?? 'Unknown artist' : 'Unknown artist';
  const toRef = (s: Song): SongRef => ({ songId: s.id, title: s.title, artistName: songArtistName(s) });

  // Missing metadata (Constitution Priority 6) — songs missing Key or BPM,
  // surfaced so they can be fixed at the source in StageTraxx.
  const missingMetadata = songs
    .filter((s) => !s.keyNote || !s.bpm)
    .map((s) => ({
      songId: s.id,
      title: s.title,
      artistName: songArtistName(s),
      missingKey: !s.keyNote,
      missingBpm: !s.bpm,
    }));

  // Metadata Health (V4 item 6) — dedicated per-issue lists for library upkeep.
  const missingKey = songs.filter((s) => !s.keyNote).map(toRef);
  const missingBpm = songs.filter((s) => !s.bpm).map(toRef);
  const missingArtist = songs.filter((s) => !s.artistId).map(toRef);
  const noFolder = songs.filter((s) => !s.folderId).map(toRef);

  const titleGroups = new Map<string, string[]>();
  for (const song of songs) {
    const normalized = song.title.trim().toLowerCase();
    if (!normalized) continue;
    const list = titleGroups.get(normalized) ?? [];
    list.push(song.id);
    titleGroups.set(normalized, list);
  }
  const titleById = new Map(songs.map((s) => [s.id, s.title]));
  const duplicateTitles = [...titleGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([, ids]) => ({ title: titleById.get(ids[0]) ?? '', songIds: ids, count: ids.length }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSongs: songs.length,
    totalArtists: artists.length,
    totalFolders: folders.length,
    songsPerFolder,
    keyDistribution,
    averageBpm,
    ratingCoverage: { ratedSongs, unratedSongs, percentRated },
    averageRatings: {
      demand: avg((r) => r.demand),
      reliability: avg((r) => r.reliability),
      enjoyment: avg((r) => r.enjoyment),
      fatigue: avg((r) => r.fatigue),
    },
    statusDistribution,
    topArtistsBySongCount,
    missingMetadata,
    metadataHealth: { missingKey, missingBpm, missingArtist, noFolder, duplicateTitles },
  };
}
