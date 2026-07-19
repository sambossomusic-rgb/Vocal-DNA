import type { Song, Rating, RepertoireStatus } from '../types/domain';
import { CHROMATIC_NOTES, DEMAND_REVIEW_THRESHOLD } from '../types/domain';

/**
 * VocalDNA's recommendation layer (Version 4). Everything here is PURE and
 * STATISTICAL — it takes plain arrays in and returns plain data out, with no
 * AI and no UI imports. It is the seam the future "intelligent performance
 * coach" grows from: new recommendation kinds are added as new pure functions
 * against the same songs/ratings/history inputs, without touching the UI or
 * the database layer.
 *
 * Implemented now: key-review candidates (the working list for updating
 * StageTraxx keys), plus two lightweight starters (learn-next, forgotten).
 * The remaining kinds in `FutureRecommendationKind` are the documented
 * roadmap — the data model already supports them (ratings + assessmentHistory
 * + tags + play counts); they just need their own function here.
 */
export type FutureRecommendationKind =
  | 'songs-to-learn-next'
  | 'forgotten-songs'
  | 'hidden-gems'
  | 'becoming-stronger'
  | 'becoming-weaker'
  | 'key-review-candidates'
  | 'vocal-warmup'
  | 'setlist-balancing'
  | 'venue-specific'
  | 'dance-style'
  | 'audience-favourites'
  | 'encore-suggestions'
  | 'rotation-suggestions';

const ACTIVE_STATUSES: RepertoireStatus[] = ['regular', 'occasional'];

export interface RecommendationOptions {
  /** Which statuses count as "active repertoire" to analyse. Defaults to Regular + Occasional. */
  includeStatuses?: RepertoireStatus[];
}

export interface KeyReviewCandidate {
  songId: string;
  title: string;
  currentKey: string;
  suggestedTestKey: string | null; // null = worth reviewing, but no data-backed key to try
  confidence: number; // 1-5 (render as stars)
  score: number; // internal ranking score, higher = more worth reviewing
  reason: string;
}

function chromaticIndex(key: string): number {
  return CHROMATIC_NOTES.indexOf(key as (typeof CHROMATIC_NOTES)[number]);
}

function transposeKey(key: string, semitones: number): string | null {
  const i = chromaticIndex(key);
  if (i === -1) return null;
  return CHROMATIC_NOTES[(i + semitones + CHROMATIC_NOTES.length) % CHROMATIC_NOTES.length];
}

/** Per-key average Performance Reliability across the analysed repertoire. */
function keyReliabilityAverages(
  entries: Array<{ rating: Rating; song: Song }>
): Map<string, { avg: number; count: number }> {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const { rating, song } of entries) {
    if (!song.keyNote || rating.reliability === null) continue;
    const e = sums.get(song.keyNote) ?? { sum: 0, count: 0 };
    e.sum += rating.reliability;
    e.count += 1;
    sums.set(song.keyNote, e);
  }
  const out = new Map<string, { avg: number; count: number }>();
  for (const [key, { sum, count }] of sums) out.set(key, { avg: sum / count, count });
  return out;
}

/**
 * Ranks songs worth experimenting with a key change (V4 items 12/13). This
 * does NOT change any keys — it produces the performer's working list for
 * updating StageTraxx by hand. Ranking factors: high Vocal Demand
 * (Tough/Challenging), lower Performance Reliability, higher Vocal Fatigue,
 * and whether a nearby key already shows stronger reliability in the
 * performer's own data.
 */
export function computeKeyReviewCandidates(
  songs: Song[],
  ratings: Rating[],
  options: RecommendationOptions = {}
): KeyReviewCandidate[] {
  const includeStatuses = new Set(options.includeStatuses ?? ACTIVE_STATUSES);
  const songById = new Map(songs.map((s) => [s.id, s]));
  const analysed = ratings
    .map((r) => ({ rating: r, song: songById.get(r.songId) }))
    .filter((e): e is { rating: Rating; song: Song } => Boolean(e.song) && includeStatuses.has(e.rating.status));

  const keyAvgs = keyReliabilityAverages(analysed);

  const candidates: KeyReviewCandidate[] = [];
  for (const { rating, song } of analysed) {
    if (!song.keyNote || rating.demand === null) continue;

    const demand = rating.demand;
    const reliability = rating.reliability;
    const fatigue = rating.fatigue;

    // A song only qualifies if it's genuinely demanding OR clearly struggling.
    const isDemanding = demand >= DEMAND_REVIEW_THRESHOLD;
    const isStruggling = reliability !== null && reliability <= 2;
    if (!isDemanding && !isStruggling) continue;

    // Ranking score: demand pushes up, low reliability pushes up, high fatigue pushes up.
    const score =
      demand + (reliability !== null ? 6 - reliability : 3) + (fatigue !== null ? fatigue : 3);

    // Look for a nearby key (±2 semitones) where the performer is, on average,
    // more reliable than in this song's current key.
    const currentKeyAvg = keyAvgs.get(song.keyNote)?.avg ?? (reliability ?? 3);
    let suggestedTestKey: string | null = null;
    let suggestedAvg = currentKeyAvg;
    for (const delta of [-1, 1, -2, 2]) {
      const near = transposeKey(song.keyNote, delta);
      if (!near) continue;
      const stat = keyAvgs.get(near);
      if (stat && stat.avg > suggestedAvg + 0.25) {
        suggestedTestKey = near;
        suggestedAvg = stat.avg;
      }
    }
    // Fallback for demanding songs with no data-backed nearby key: suggest a
    // gentle semitone down as an experiment.
    if (!suggestedTestKey && isDemanding) {
      suggestedTestKey = transposeKey(song.keyNote, -1);
    }

    // Confidence (1-5 stars): how strong the case is.
    let confidence = 2;
    if (demand >= 5) confidence += 1;
    if (reliability !== null && reliability <= 2) confidence += 1;
    if (fatigue !== null && fatigue >= 4) confidence += 1;
    confidence = Math.max(1, Math.min(5, confidence));

    const parts: string[] = [];
    parts.push(demand >= 5 ? 'Challenging vocal demand' : 'Tough vocal demand');
    if (reliability !== null && reliability <= 2) parts.push(`lower reliability (${reliability}/5)`);
    if (fatigue !== null && fatigue >= 4) parts.push(`high fatigue (${fatigue}/5)`);
    if (suggestedTestKey && suggestedAvg > currentKeyAvg + 0.25) {
      parts.push(`you average ${suggestedAvg.toFixed(1)}/5 reliability in ${suggestedTestKey}`);
    }
    const reason = parts.join('; ') + '.';

    candidates.push({
      songId: song.id,
      title: song.title,
      currentKey: song.keyNote,
      suggestedTestKey,
      confidence,
      score,
      reason,
    });
  }

  return candidates.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}

// --- Lightweight starters for the future engine (V4 item 14). Real, but
// deliberately simple — they establish the shape future work refines. ---

export interface SongSuggestion {
  songId: string;
  title: string;
  reason: string;
}

/** Songs the performer is actively learning, surfaced highest-enjoyment first as the natural next focus. */
export function computeSongsToLearnNext(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  const ratingBySong = new Map(ratings.map((r) => [r.songId, r]));
  return songs
    .map((s) => ({ song: s, rating: ratingBySong.get(s.id) }))
    .filter((e) => e.rating?.status === 'learning')
    .sort((a, b) => (b.rating?.enjoyment ?? 0) - (a.rating?.enjoyment ?? 0))
    .slice(0, 20)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: e.rating?.enjoyment ? `Learning · enjoyment ${e.rating.enjoyment}/5` : 'Currently learning',
    }));
}

/** In-rotation songs not played in a long time (by StageTraxx lastPlayed) — candidates to revive. */
export function computeForgottenSongs(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  const ratingBySong = new Map(ratings.map((r) => [r.songId, r]));
  return songs
    .map((s) => ({ song: s, rating: ratingBySong.get(s.id) }))
    .filter((e) => e.rating && ACTIVE_STATUSES.includes(e.rating.status) && e.song.lastPlayed)
    .sort((a, b) => new Date(a.song.lastPlayed!).getTime() - new Date(b.song.lastPlayed!).getTime())
    .slice(0, 20)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: `Last played ${new Date(e.song.lastPlayed!).toLocaleDateString()}`,
    }));
}
