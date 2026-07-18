import type { Song, Rating } from '../types/domain';

export interface KeyConfidence {
  key: string;
  songCount: number;
  averageConfidence: number;
  averageDifficulty: number;
}

export interface TransposePattern {
  transpose: number;
  songCount: number;
}

export interface RepertoireQuadrant {
  label: 'Strongest' | 'Growing' | 'Needs work' | 'Comfort zone';
  description: string;
  songIds: string[];
}

export interface FatigueTrendPoint {
  ratedAt: string;
  songTitle: string;
  fatigue: number;
}

export interface VoiceProfileSnapshot {
  ratedSongCount: number;
  strongestKeys: KeyConfidence[]; // sorted by averageConfidence desc
  mostDifficultKeys: KeyConfidence[]; // sorted by averageDifficulty desc
  transposePatterns: TransposePattern[]; // sorted by songCount desc
  averageTranspose: number | null;
  quadrants: RepertoireQuadrant[];
  fatigueTrend: FatigueTrendPoint[]; // last N rated songs, chronological
}

const MID_SCALE = 3; // midpoint of the 1-5 rating scale, used for quadrant splits

/**
 * Builds a Voice Profile purely from what the singer has actually recorded:
 * their own difficulty/confidence/enjoyment/fatigue/transpose ratings, joined
 * against each song's key. This deliberately does NOT claim to analyze audio
 * or vocal range from a recording — VocalDNA has no audio-analysis pipeline
 * in Version 1, so the profile is an honest reflection of self-reported data,
 * not a fabricated acoustic measurement.
 */
export function computeVoiceProfile(songs: Song[], ratings: Rating[]): VoiceProfileSnapshot {
  const songById = new Map(songs.map((s) => [s.id, s]));
  const ratedEntries = ratings
    .map((r) => ({ rating: r, song: songById.get(r.songId) }))
    .filter((e): e is { rating: Rating; song: Song } => Boolean(e.song));

  // --- Key-based confidence/difficulty ---
  const byKey = new Map<string, { confidenceSum: number; difficultySum: number; count: number }>();
  for (const { rating, song } of ratedEntries) {
    if (!song.keyNote) continue;
    const entry = byKey.get(song.keyNote) ?? { confidenceSum: 0, difficultySum: 0, count: 0 };
    entry.confidenceSum += rating.confidence;
    entry.difficultySum += rating.difficulty;
    entry.count += 1;
    byKey.set(song.keyNote, entry);
  }
  const keyStats: KeyConfidence[] = [...byKey.entries()].map(([key, v]) => ({
    key,
    songCount: v.count,
    averageConfidence: v.confidenceSum / v.count,
    averageDifficulty: v.difficultySum / v.count,
  }));

  const strongestKeys = [...keyStats].sort((a, b) => b.averageConfidence - a.averageConfidence);
  const mostDifficultKeys = [...keyStats].sort(
    (a, b) => b.averageDifficulty - a.averageDifficulty
  );

  // --- Transpose patterns ---
  const transposeCounts = new Map<number, number>();
  for (const { rating } of ratedEntries) {
    transposeCounts.set(rating.transpose, (transposeCounts.get(rating.transpose) ?? 0) + 1);
  }
  const transposePatterns: TransposePattern[] = [...transposeCounts.entries()]
    .map(([transpose, songCount]) => ({ transpose, songCount }))
    .sort((a, b) => b.songCount - a.songCount);

  const averageTranspose =
    ratedEntries.length > 0
      ? ratedEntries.reduce((acc, e) => acc + e.rating.transpose, 0) / ratedEntries.length
      : null;

  // --- Repertoire quadrants (difficulty x confidence) ---
  const strongest = ratedEntries.filter(
    (e) => e.rating.confidence >= MID_SCALE + 1 && e.rating.difficulty <= MID_SCALE - 1
  );
  const growing = ratedEntries.filter(
    (e) => e.rating.confidence < MID_SCALE + 1 && e.rating.difficulty <= MID_SCALE - 1
  );
  const needsWork = ratedEntries.filter(
    (e) => e.rating.confidence < MID_SCALE + 1 && e.rating.difficulty > MID_SCALE - 1
  );
  const comfortZone = ratedEntries.filter(
    (e) => e.rating.confidence >= MID_SCALE + 1 && e.rating.difficulty > MID_SCALE - 1
  );

  const quadrants: RepertoireQuadrant[] = [
    {
      label: 'Strongest',
      description: 'High confidence, low difficulty — reliable performance material.',
      songIds: strongest.map((e) => e.song.id),
    },
    {
      label: 'Comfort zone',
      description: 'High confidence despite real difficulty — hard-won strengths.',
      songIds: comfortZone.map((e) => e.song.id),
    },
    {
      label: 'Growing',
      description: 'Lower difficulty but confidence still building.',
      songIds: growing.map((e) => e.song.id),
    },
    {
      label: 'Needs work',
      description: 'High difficulty and low confidence — priority practice targets.',
      songIds: needsWork.map((e) => e.song.id),
    },
  ];

  // --- Fatigue trend, most recent 20 ratings chronologically ---
  const fatigueTrend: FatigueTrendPoint[] = [...ratedEntries]
    .sort((a, b) => new Date(a.rating.ratedAt).getTime() - new Date(b.rating.ratedAt).getTime())
    .slice(-20)
    .map((e) => ({
      ratedAt: e.rating.ratedAt,
      songTitle: e.song.title,
      fatigue: e.rating.fatigue,
    }));

  return {
    ratedSongCount: ratedEntries.length,
    strongestKeys,
    mostDifficultKeys,
    transposePatterns,
    averageTranspose,
    quadrants,
    fatigueTrend,
  };
}
