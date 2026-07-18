import type { Rating, Song, PerformanceFrequency } from '../types/domain';
import { PERFORMANCE_FREQUENCIES } from '../types/domain';

export interface TagLearning {
  tagId: string;
  sampleSize: number; // rated songs carrying this tag
  demandSampleSize: number;
  reliabilitySampleSize: number;
  averageDemand: number | null;
  averageReliability: number | null;
  frequencyCounts: Record<PerformanceFrequency, number>;
}

export interface GlobalLearning {
  sampleSize: number;
  averageDemand: number | null;
  averageReliability: number | null;
  averageTranspose: number | null;
  frequencyCounts: Record<PerformanceFrequency, number>;
}

export interface SongPrediction {
  songId: string;
  predictedFrequency: PerformanceFrequency | null;
  predictedDemand: number | null;
  predictedReliability: number | null;
  predictedTranspose: number | null;
  sampleSize: number; // how many prior ratings this prediction draws on
}

function emptyFrequencyCounts(): Record<PerformanceFrequency, number> {
  return { regular: 0, occasional: 0, learning: 0, never: 0 };
}

function pickMode(counts: Record<PerformanceFrequency, number>): PerformanceFrequency | null {
  let best: PerformanceFrequency | null = null;
  let bestCount = 0;
  for (const freq of PERFORMANCE_FREQUENCIES) {
    if (counts[freq] > bestCount) {
      best = freq;
      bestCount = counts[freq];
    }
  }
  return best;
}

/**
 * Statistical learning per tag — no AI, just aggregates of the performer's
 * own prior ratings for every other song sharing a tag. This is what lets
 * "rate a few Country songs at Demand 4" turn into a default suggestion for
 * the next unrated Country song (Constitution Feature 4).
 */
export function computeTagLearning(
  ratings: Rating[],
  songTagIds: Map<string, string[]>
): Map<string, TagLearning> {
  const byTag = new Map<string, TagLearning>();

  const get = (tagId: string): TagLearning => {
    let entry = byTag.get(tagId);
    if (!entry) {
      entry = {
        tagId,
        sampleSize: 0,
        demandSampleSize: 0,
        reliabilitySampleSize: 0,
        averageDemand: null,
        averageReliability: null,
        frequencyCounts: emptyFrequencyCounts(),
      };
      byTag.set(tagId, entry);
    }
    return entry;
  };

  const demandSums = new Map<string, number>();
  const reliabilitySums = new Map<string, number>();

  for (const rating of ratings) {
    if (!rating.performanceFrequency) continue;
    const tagIds = songTagIds.get(rating.songId) ?? [];
    for (const tagId of tagIds) {
      const entry = get(tagId);
      entry.sampleSize += 1;
      entry.frequencyCounts[rating.performanceFrequency] += 1;

      if (typeof rating.demand === 'number') {
        entry.demandSampleSize += 1;
        demandSums.set(tagId, (demandSums.get(tagId) ?? 0) + rating.demand);
      }
      if (typeof rating.reliability === 'number') {
        entry.reliabilitySampleSize += 1;
        reliabilitySums.set(tagId, (reliabilitySums.get(tagId) ?? 0) + rating.reliability);
      }
    }
  }

  for (const [tagId, entry] of byTag) {
    const demandSum = demandSums.get(tagId);
    const reliabilitySum = reliabilitySums.get(tagId);
    entry.averageDemand = demandSum && entry.demandSampleSize > 0 ? demandSum / entry.demandSampleSize : null;
    entry.averageReliability =
      reliabilitySum && entry.reliabilitySampleSize > 0 ? reliabilitySum / entry.reliabilitySampleSize : null;
  }

  return byTag;
}

/** Fallback learning across every rated song, used when a song has no tags or its tags have no data yet. */
export function computeGlobalLearning(ratings: Rating[]): GlobalLearning {
  const frequencyCounts = emptyFrequencyCounts();
  let demandSum = 0;
  let demandCount = 0;
  let reliabilitySum = 0;
  let reliabilityCount = 0;
  let transposeSum = 0;
  let transposeCount = 0;

  for (const rating of ratings) {
    if (rating.performanceFrequency) frequencyCounts[rating.performanceFrequency] += 1;
    if (typeof rating.demand === 'number') {
      demandSum += rating.demand;
      demandCount += 1;
    }
    if (typeof rating.reliability === 'number') {
      reliabilitySum += rating.reliability;
      reliabilityCount += 1;
    }
    transposeSum += rating.transpose;
    transposeCount += 1;
  }

  return {
    sampleSize: ratings.length,
    averageDemand: demandCount > 0 ? demandSum / demandCount : null,
    averageReliability: reliabilityCount > 0 ? reliabilitySum / reliabilityCount : null,
    averageTranspose: transposeCount > 0 ? transposeSum / transposeCount : null,
    frequencyCounts,
  };
}

/** Average transpose already recorded for each key, used to predict a new song's transpose from its own key. */
export function computeKeyTransposeAverages(songs: Song[], ratings: Rating[]): Map<string, number> {
  const songById = new Map(songs.map((s) => [s.id, s]));
  const sums = new Map<string, { sum: number; count: number }>();

  for (const rating of ratings) {
    const song = songById.get(rating.songId);
    if (!song?.keyNote) continue;
    const entry = sums.get(song.keyNote) ?? { sum: 0, count: 0 };
    entry.sum += rating.transpose;
    entry.count += 1;
    sums.set(song.keyNote, entry);
  }

  const averages = new Map<string, number>();
  for (const [key, { sum, count }] of sums) averages.set(key, sum / count);
  return averages;
}

/**
 * Predicts likely frequency/demand/reliability/transpose for one song from
 * the performer's own prior ratings — a weighted blend of every tag the
 * song carries, falling back to the global average when there's no tag
 * data yet. Purely statistical, no machine learning model involved.
 */
export function predictForSong(
  song: Song,
  tagIds: string[],
  tagLearning: Map<string, TagLearning>,
  globalLearning: GlobalLearning,
  keyTransposeAverages: Map<string, number>
): SongPrediction {
  const relevantTags = tagIds.map((id) => tagLearning.get(id)).filter((t): t is TagLearning => Boolean(t));

  const combinedFrequencyCounts = emptyFrequencyCounts();
  let demandWeightedSum = 0;
  let demandWeight = 0;
  let reliabilityWeightedSum = 0;
  let reliabilityWeight = 0;
  let totalSampleSize = 0;

  for (const tag of relevantTags) {
    totalSampleSize += tag.sampleSize;
    for (const freq of PERFORMANCE_FREQUENCIES) {
      combinedFrequencyCounts[freq] += tag.frequencyCounts[freq];
    }
    if (tag.averageDemand !== null) {
      demandWeightedSum += tag.averageDemand * tag.demandSampleSize;
      demandWeight += tag.demandSampleSize;
    }
    if (tag.averageReliability !== null) {
      reliabilityWeightedSum += tag.averageReliability * tag.reliabilitySampleSize;
      reliabilityWeight += tag.reliabilitySampleSize;
    }
  }

  const predictedFrequency = pickMode(combinedFrequencyCounts) ?? pickMode(globalLearning.frequencyCounts);
  const predictedDemand =
    demandWeight > 0 ? demandWeightedSum / demandWeight : globalLearning.averageDemand;
  const predictedReliability =
    reliabilityWeight > 0 ? reliabilityWeightedSum / reliabilityWeight : globalLearning.averageReliability;
  const predictedTranspose =
    (song.keyNote ? keyTransposeAverages.get(song.keyNote) : undefined) ??
    globalLearning.averageTranspose ??
    null;

  return {
    songId: song.id,
    predictedFrequency,
    predictedDemand: predictedDemand !== null ? Math.round(predictedDemand) : null,
    predictedReliability: predictedReliability !== null ? Math.round(predictedReliability) : null,
    predictedTranspose: predictedTranspose !== null ? Math.round(predictedTranspose) : null,
    sampleSize: totalSampleSize > 0 ? totalSampleSize : globalLearning.sampleSize,
  };
}
