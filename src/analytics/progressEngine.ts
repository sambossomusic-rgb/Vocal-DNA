import type { Rating, RepertoireStatus } from '../types/domain';
import { REPERTOIRE_STATUSES } from '../types/domain';

export interface ProgressSnapshot {
  songsImported: number;
  songsAssessed: number;
  songsRemaining: number;
  mostCommonStatus: RepertoireStatus | null;
  predictionConfidencePercent: number; // 0-100
}

// Rough, honest confidence signal: more assessed songs means tag/global
// averages are backed by more data. Capped at 100% once 30 or more ratings
// exist — beyond that, more data doesn't meaningfully change an average.
const CONFIDENCE_SAMPLE_CEILING = 30;

export function computeProgress(songsImported: number, ratings: Rating[]): ProgressSnapshot {
  const statusCounts: Record<RepertoireStatus, number> = {
    regular: 0,
    occasional: 0,
    learning: 0,
    unexplored: 0,
  };
  for (const rating of ratings) statusCounts[rating.status] += 1;

  let mostCommonStatus: RepertoireStatus | null = null;
  let mostCommonCount = 0;
  for (const status of REPERTOIRE_STATUSES) {
    if (statusCounts[status] > mostCommonCount) {
      mostCommonStatus = status;
      mostCommonCount = statusCounts[status];
    }
  }

  const predictionConfidencePercent = Math.round(
    Math.min(1, ratings.length / CONFIDENCE_SAMPLE_CEILING) * 100
  );

  return {
    songsImported,
    songsAssessed: ratings.length,
    songsRemaining: Math.max(0, songsImported - ratings.length),
    mostCommonStatus,
    predictionConfidencePercent,
  };
}
