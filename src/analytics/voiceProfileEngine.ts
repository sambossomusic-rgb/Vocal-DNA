import type { Song, Rating } from '../types/domain';

export interface KeyReliability {
  key: string;
  songCount: number;
  averageReliability: number;
  averageDemand: number;
}

export interface RepertoireQuadrant {
  label: 'Strongest' | 'Growing' | 'Needs work' | 'Comfort zone';
  description: string;
  songIds: string[];
}

export interface FatigueTrendPoint {
  songId: string;
  ratedAt: string;
  songTitle: string;
  fatigue: number;
}

export interface KeyChangeRecommendation {
  songId: string;
  title: string;
  currentKey: string;
  suggestedKey: string;
  confidenceGain: number; // reliability points, 0-4
  reason: string;
}

export interface VoiceProfileSnapshot {
  ratedSongCount: number;
  strongestKeys: KeyReliability[]; // sorted by averageReliability desc
  weakestKeys: KeyReliability[]; // sorted by averageReliability asc
  quadrants: RepertoireQuadrant[];
  fatigueTrend: FatigueTrendPoint[]; // last N Pass-Two-rated songs, chronological
  keyChangeRecommendations: KeyChangeRecommendation[]; // best confidence gains first
}

const MID_SCALE = 3; // midpoint of the 1-5 rating scale, used for quadrant splits
const MIN_KEY_SAMPLE = 2; // don't suggest a key the performer has barely used
const MIN_RECOMMEND_GAIN = 1; // only surface a change worth at least +1 reliability

/**
 * Builds a Voice Profile purely from what the singer has actually recorded:
 * their own demand/reliability/enjoyment/fatigue ratings joined against each
 * song's key. This deliberately does NOT claim to analyze audio or vocal
 * range from a recording — VocalDNA has no audio-analysis pipeline, so the
 * profile is an honest reflection of self-reported data, not a fabricated
 * acoustic measurement.
 */
export function computeVoiceProfile(songs: Song[], ratings: Rating[]): VoiceProfileSnapshot {
  const songById = new Map(songs.map((s) => [s.id, s]));
  const withSong = ratings
    .map((r) => ({ rating: r, song: songById.get(r.songId) }))
    .filter((e): e is { rating: Rating; song: Song } => Boolean(e.song));

  // Pass One complete: both Demand and Reliability set.
  const passOneEntries = withSong.filter(
    (e): e is { rating: Rating & { demand: number; reliability: number }; song: Song } =>
      e.rating.demand !== null && e.rating.reliability !== null
  );

  // --- Key-based reliability/demand ---
  const byKey = new Map<string, { reliabilitySum: number; demandSum: number; count: number }>();
  for (const { rating, song } of passOneEntries) {
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

  // --- Recommended key changes (Version 3) ---
  // Statistical, not AI: for each song the performer rates low-reliability,
  // if there's another key where they *average* meaningfully higher
  // reliability (backed by a few songs), suggest moving to it. The reason
  // text states exactly what the data shows, and it's always a suggestion —
  // the performer decides. Vocal range still matters per song, so this is a
  // starting point, not an instruction.
  const reliableKeys = keyStats
    .filter((k) => k.songCount >= MIN_KEY_SAMPLE)
    .sort((a, b) => b.averageReliability - a.averageReliability);
  const bestKey = reliableKeys[0];

  const keyChangeRecommendations: KeyChangeRecommendation[] = [];
  if (bestKey) {
    for (const { rating, song } of passOneEntries) {
      if (!song.keyNote || song.keyNote === bestKey.key) continue;
      const gain = bestKey.averageReliability - rating.reliability;
      if (gain < MIN_RECOMMEND_GAIN) continue;
      keyChangeRecommendations.push({
        songId: song.id,
        title: song.title,
        currentKey: song.keyNote,
        suggestedKey: bestKey.key,
        confidenceGain: Math.round(gain),
        reason: `You rate this ${rating.reliability}/5 in ${song.keyNote}; you average ${bestKey.averageReliability.toFixed(
          1
        )}/5 across ${bestKey.songCount} songs in ${bestKey.key}.`,
      });
    }
  }
  keyChangeRecommendations.sort((a, b) => b.confidenceGain - a.confidenceGain);

  // --- Repertoire quadrants (demand x reliability), Pass One songs only ---
  const strongest = passOneEntries.filter(
    (e) => e.rating.reliability >= MID_SCALE + 1 && e.rating.demand <= MID_SCALE - 1
  );
  const growing = passOneEntries.filter(
    (e) => e.rating.reliability < MID_SCALE + 1 && e.rating.demand <= MID_SCALE - 1
  );
  const needsWork = passOneEntries.filter(
    (e) => e.rating.reliability < MID_SCALE + 1 && e.rating.demand > MID_SCALE - 1
  );
  const comfortZone = passOneEntries.filter(
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

  // --- Fatigue trend, most recent 20 Pass-Two-rated songs chronologically ---
  const fatigueTrend: FatigueTrendPoint[] = withSong
    .filter((e): e is { rating: Rating & { fatigue: number }; song: Song } => e.rating.fatigue !== null)
    .sort((a, b) => new Date(a.rating.ratedAt).getTime() - new Date(b.rating.ratedAt).getTime())
    .slice(-20)
    .map((e) => ({
      songId: e.song.id,
      ratedAt: e.rating.ratedAt,
      songTitle: e.song.title,
      fatigue: e.rating.fatigue,
    }));

  return {
    ratedSongCount: passOneEntries.length,
    strongestKeys,
    weakestKeys,
    quadrants,
    fatigueTrend,
    keyChangeRecommendations,
  };
}
