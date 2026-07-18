import type { Song, Artist, Folder, Rating, RepertoireStatus } from '../types/domain';
import { REPERTOIRE_STATUS_PRIORITY } from '../types/domain';

export interface StatsSnapshot {
  totalSongs: number;
  totalArtists: number;
  totalFolders: number;
  songsPerFolder: Array<{ folderName: string; count: number }>;
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
  topArtistsBySongCount: Array<{ artistName: string; count: number }>;
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
  const folderCounts = new Map<string, number>();
  for (const song of songs) {
    const name = song.folderId ? folderNameById.get(song.folderId) ?? 'Unknown folder' : 'No folder';
    folderCounts.set(name, (folderCounts.get(name) ?? 0) + 1);
  }
  const songsPerFolder = [...folderCounts.entries()]
    .map(([folderName, count]) => ({ folderName, count }))
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

  // Average rating dimensions (only across songs that have a rating)
  const avg = (selector: (r: Rating) => number): number | null => {
    if (ratings.length === 0) return null;
    const sum = ratings.reduce((acc, r) => acc + selector(r), 0);
    return sum / ratings.length;
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
    const name = artistNameById.get(song.artistId) ?? 'Unknown artist';
    artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
  }
  const topArtistsBySongCount = [...artistCounts.entries()]
    .map(([artistName, count]) => ({ artistName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

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
  };
}
