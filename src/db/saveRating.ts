import { db } from './db';
import type { Rating } from '../types/domain';

/**
 * The single write path for a rating (Version 4). Persists the current rating
 * AND appends an immutable snapshot to `assessmentHistory`, so trend features
 * ("becoming stronger / weaker", rotation) have a real timeline to read.
 *
 * Does NOT bump the data version — callers do that once after their own batch
 * of writes. Safe to call inside a Dexie transaction as long as that
 * transaction includes `ratings`, `assessmentHistory`, and `songs`.
 */
export async function saveRating(rating: Rating): Promise<void> {
  const song = await db.songs.get(rating.songId);
  await db.ratings.put(rating);
  await db.assessmentHistory.add({
    id: crypto.randomUUID(),
    songId: rating.songId,
    recordedAt: rating.ratedAt,
    demand: rating.demand,
    reliability: rating.reliability,
    enjoyment: rating.enjoyment,
    fatigue: rating.fatigue,
    status: rating.status,
    keyNote: song?.keyNote ?? null,
  });
}
