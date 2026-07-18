import type { Song, Rating } from '../types/domain';

export interface KeyReliability {
  key: string;
  songCount: number;
  averageReliability: number;
  averageDemand: number;
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
  strongestKeys: KeyReliability[]; // sorted by averageReliability desc
  weakestKeys: KeyReliability[]; // sorted by averageReliability asc
  transposePatterns: TransposePattern[]; // sorted by songCount desc
  averageTranspose: number | null;
  quadrants: RepertoireQuadrant[];
  fatigueTrend: FatigueTrendPoint[]; // last N rated songs, chronological
}

const MID_SCALE = 5; // midpoint of the 1-10 rating scale, used for quadrant splits

/**
 * Builds a Voice Profile purely from what the singer has actually recorded:
 * their own demand/reliability/enjoyment/fatigue/transpose ratings, joined
 * against each song's key. This deliberately does NOT claim to analyze audio
 * or vocal range from a recording — VocalDNA has no audio-analysis pipeline,
 * so the profile is an honest reflection of self-reported data, not a
 * fabricated acoustic measurement.
 */
export function computeVoiceProfile(songs: Song[], ratings: Rating[]): VoiceProfileSnapshot {
  const songById = new Map(songs.map((s) => [s.id, s]));
  const ratedEntries = ratings
    .map((r) => ({ rating: r, song: songById.get(r.songId) }))
    .filter((e): e is { rating: Rating; song: Song } => Boolean(e.song));

  // --- Key-based reliability/demand ---
  const byKey = new Map<string, { reliabilitySum: number; demandSum: number; count: number }>();
  for (const { rating, song } of ratedEntries) {
    if (!song.keyNote) continue;
    const entry = byKey.get(song.keyNote) ?? { reliabilitySum: 0, demandSum: 0, count: 0 };
    entry.reliabilitySum += rating.reliability;
    entry.demandSum += rating.demand;
    entry.count += 1;
    byKey.set(song.keyNote, entry);
  }
  const keyStats: KeyReliability[] = [...byKey.entries()].map(([key, v]) => ({
    key,
    songCount: v.count,
    averageReliability: v.reliabilitySum / v.count,
    averageDemand: v.demandSum / v.count,
  }));

  const strongestKeys = [...keyStats].sort((a, b) => b.averageReliability - a.averageReliability);
  const weakestKeys = [...keyStats].sort((a, b) => a.averageReliability - b.averageReliability);

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

  // --- Repertoire quadrants (demand x reliability) ---
  const strongest = ratedEntries.filter(
    (e) => e.rating.reliability >= MID_SCALE + 1 && e.rating.demand <= MID_SCALE - 1
  );
  const growing = ratedEntries.filter(
    (e) => e.rating.reliability < MID_SCALE + 1 && e.rating.demand <= MID_SCALE - 1
  );
  const needsWork = ratedEntries.filter(
    (e) => e.rating.reliability < MID_SCALE + 1 && e.rating.demand > MID_SCALE - 1
  );
  const comfortZone = ratedEntries.filter(
    (e) => e.rating.reliability >= MID_SCALE + 1 && e.rating.demand > MID_SCALE - 1
  );

  const quadrants: RepertoireQuadrant[] = [
    {
      label: 'Strongest',
      description: 'High reliability, lower demand — steady, dependable material.',
      songIds: strongest.map((e) => e.song.id),
    },
    {
      label: 'Comfort zone',
      description: 'High reliability despite high demand — hard-won strengths.',
      songIds: comfortZone.map((e) => e.song.id),
    },
    {
      label: 'Growing',
      description: 'Lower demand, reliability still building.',
      songIds: growing.map((e) => e.song.id),
    },
    {
      label: 'Needs work',
      description: 'High demand but reliability still building — priority practice targets.',
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
    weakestKeys,
    transposePatterns,
    averageTranspose,
    quadrants,
    fatigueTrend,
  };
}
