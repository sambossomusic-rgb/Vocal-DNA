import type { Rating, Song, RepertoireStatus } from '../types/domain';
import { REPERTOIRE_STATUSES } from '../types/domain';

export interface TagLearning {
  tagId: string;
  sampleSize: number; // rated songs carrying this tag
  averageDemand: number;
  averageReliability: number;
  statusCounts: Record<RepertoireStatus, number>;
}

export interface GlobalLearning {
  sampleSize: number;
  averageDemand: number | null;
  averageReliability: number | null;
  averageTranspose: number | null;
  statusCounts: Record<RepertoireStatus, number>;
}

export interface SongPrediction {
  songId: string;
  predictedStatus: RepertoireStatus | null;
  predictedDemand: number | null;
  predictedReliability: number | null;
  predictedTranspose: number | null;
  sampleSize: number; // how many prior ratings this prediction draws on
}

function emptyStatusCounts(): Record<RepertoireStatus, number> {
  return { regular: 0, occasional: 0, learning: 0, unexplored: 0 };
}

function pickMode(counts: Record<RepertoireStatus, number>): RepertoireStatus | null {
  let best: RepertoireStatus | null = null;
  let bestCount = 0;
  for (const status of REPERTOIRE_STATUSES) {
    if (counts[status] > bestCount) {
      best = status;
      bestCount = counts[status];
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
  const sums = new Map<string, { demandSum: number; reliabilitySum: number; count: number; statusCounts: Record<RepertoireStatus, number> }>();

  for (const rating of ratings) {
    const tagIds = songTagIds.get(rating.songId) ?? [];
    for (const tagId of tagIds) {
      const entry = sums.get(tagId) ?? {
        demandSum: 0,
        reliabilitySum: 0,
        count: 0,
        statusCounts: emptyStatusCounts(),
      };
      entry.demandSum += rating.demand;
      entry.reliabilitySum += rating.reliability;
      entry.count += 1;
      entry.statusCounts[rating.status] += 1;
      sums.set(tagId, entry);
    }
  }

  const byTag = new Map<string, TagLearning>();
  for (const [tagId, entry] of sums) {
    byTag.set(tagId, {
      tagId,
      sampleSize: entry.count,
      averageDemand: entry.demandSum / entry.count,
      averageReliability: entry.reliabilitySum / entry.count,
      statusCounts: entry.statusCounts,
    });
  }
  return byTag;
}

/** Fallback learning across every rated song, used when a song has no tags or its tags have no data yet. */
export function computeGlobalLearning(ratings: Rating[]): GlobalLearning {
  const statusCounts = emptyStatusCounts();
  let demandSum = 0;
  let reliabilitySum = 0;
  let transposeSum = 0;

  for (const rating of ratings) {
    statusCounts[rating.status] += 1;
    demandSum += rating.demand;
    reliabilitySum += rating.reliability;
    transposeSum += rating.transpose;
  }

  return {
    sampleSize: ratings.length,
    averageDemand: ratings.length > 0 ? demandSum / ratings.length : null,
    averageReliability: ratings.length > 0 ? reliabilitySum / ratings.length : null,
    averageTranspose: ratings.length > 0 ? transposeSum / ratings.length : null,
    statusCounts,
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
 * Predicts likely status/demand/reliability/transpose for one song from the
 * performer's own prior ratings — a weighted blend of every tag the song
 * carries, falling back to the global average when there's no tag data yet.
 * Purely statistical, no machine learning model involved.
 */
export function predictForSong(
  song: Song,
  tagIds: string[],
  tagLearning: Map<string, TagLearning>,
  globalLearning: GlobalLearning,
  keyTransposeAverages: Map<string, number>
): SongPrediction {
  const relevantTags = tagIds.map((id) => tagLearning.get(id)).filter((t): t is TagLearning => Boolean(t));

  const combinedStatusCounts = emptyStatusCounts();
  let demandWeightedSum = 0;
  let reliabilityWeightedSum = 0;
  let totalSampleSize = 0;

  for (const tag of relevantTags) {
    totalSampleSize += tag.sampleSize;
    for (const status of REPERTOIRE_STATUSES) {
      combinedStatusCounts[status] += tag.statusCounts[status];
    }
    demandWeightedSum += tag.averageDemand * tag.sampleSize;
    reliabilityWeightedSum += tag.averageReliability * tag.sampleSize;
  }

  const predictedStatus = pickMode(combinedStatusCounts) ?? pickMode(globalLearning.statusCounts);
  const predictedDemand =
    totalSampleSize > 0 ? demandWeightedSum / totalSampleSize : globalLearning.averageDemand;
  const predictedReliability =
    totalSampleSize > 0 ? reliabilityWeightedSum / totalSampleSize : globalLearning.averageReliability;
  const predictedTranspose =
    (song.keyNote ? keyTransposeAverages.get(song.keyNote) : undefined) ??
    globalLearning.averageTranspose ??
    null;

  return {
    songId: song.id,
    predictedStatus,
    predictedDemand: predictedDemand !== null ? Math.round(predictedDemand) : null,
    predictedReliability: predictedReliability !== null ? Math.round(predictedReliability) : null,
    predictedTranspose: predictedTranspose !== null ? Math.round(predictedTranspose) : null,
    sampleSize: totalSampleSize > 0 ? totalSampleSize : globalLearning.sampleSize,
  };
}
