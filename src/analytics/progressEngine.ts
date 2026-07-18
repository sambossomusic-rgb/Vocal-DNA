import type { Rating, PerformanceFrequency } from '../types/domain';
import { PERFORMANCE_FREQUENCIES } from '../types/domain';

export interface ProgressSnapshot {
  songsImported: number;
  songsAssessed: number;
  songsRemaining: number;
  mostCommonFrequency: PerformanceFrequency | null;
  predictionConfidencePercent: number; // 0-100
}

// Rough, honest confidence signal: more fully-followed-up ratings (with a
// demand value) means tag/global averages are backed by more data. Capped
// at 100% once 30 or more such ratings exist — beyond that, more data
// doesn't meaningfully change an average.
const CONFIDENCE_SAMPLE_CEILING = 30;

export function computeProgress(songsImported: number, ratings: Rating[]): ProgressSnapshot {
  const assessed = ratings.filter((r) => Boolean(r.performanceFrequency));

  const frequencyCounts: Record<PerformanceFrequency, number> = {
    regular: 0,
    occasional: 0,
    learning: 0,
    never: 0,
  };
  for (const rating of assessed) {
    if (rating.performanceFrequency) frequencyCounts[rating.performanceFrequency] += 1;
  }
  let mostCommonFrequency: PerformanceFrequency | null = null;
  let mostCommonCount = 0;
  for (const freq of PERFORMANCE_FREQUENCIES) {
    if (frequencyCounts[freq] > mostCommonCount) {
      mostCommonFrequency = freq;
      mostCommonCount = frequencyCounts[freq];
    }
  }

  const demandSampleSize = ratings.filter((r) => typeof r.demand === 'number').length;
  const predictionConfidencePercent = Math.round(
    Math.min(1, demandSampleSize / CONFIDENCE_SAMPLE_CEILING) * 100
  );

  return {
    songsImported,
    songsAssessed: assessed.length,
    songsRemaining: Math.max(0, songsImported - assessed.length),
    mostCommonFrequency,
    predictionConfidencePercent,
  };
}
