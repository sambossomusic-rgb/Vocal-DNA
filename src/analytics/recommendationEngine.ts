import type { Song, Rating, RepertoireStatus } from '../types/domain';
import { CHROMATIC_NOTES, DEMAND_REVIEW_THRESHOLD } from '../types/domain';

/**
 * VocalDNA's recommendation layer (Version 4, expanded in Version 5).
 * Everything here is PURE and STATISTICAL — it takes plain arrays in and
 * returns plain data out, with no AI and no UI imports. It is the seam the
 * "intelligent performance companion" grows from: every recommendation kind
 * is a pure function against the same songs/ratings inputs, so the UI never
 * embeds any decision logic.
 *
 * Every function answers a repertoire-decision question (the Constitution's
 * "better decisions over more information"): what to sing tonight, what to
 * revive, learn, promote, practise, or review.
 *
 * Vocal Efficiency Review (V5 item 12) is the framing for key work: VocalDNA
 * never says a key is "wrong". It surfaces songs where a different key MIGHT
 * sit more comfortably, always as a supportive experiment to try, with the
 * performer's own data as the reasoning.
 */

/** The performer-facing name for the key-review philosophy (V5 item 12). */
export const VOCAL_EFFICIENCY_REVIEW_TITLE = 'Vocal Efficiency Review';

export type FutureRecommendationKind =
  | 'songs-to-learn-next'
  | 'rediscover-songs'
  | 'ready-for-promotion'
  | 'needs-practice'
  | 'hidden-gems'
  | 'recovery-songs'
  | 'high-demand-songs'
  | 'key-review-candidates'
  | 'becoming-stronger'
  | 'becoming-weaker'
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

// ---------------------------------------------------------------------------
// Per-song Vocal Efficiency Review (V5 item 12)
//
// A supportive, single-song verdict on whether a different key is worth an
// experiment. Never says a key is wrong — the four verdicts are: try a
// specific key, try a little lower, current key appears optimal, or (not
// enough data) no recommendation yet. This is what the Song Coach reads.
// ---------------------------------------------------------------------------

export type VocalEfficiencyVerdict =
  | 'experiment-specific-key'
  | 'experiment-lower'
  | 'optimal'
  | 'no-recommendation';

export interface VocalEfficiencyReview {
  verdict: VocalEfficiencyVerdict;
  currentKey: string | null;
  suggestedKey: string | null;
  headline: string; // e.g. "Experiment with F#", "Current key appears optimal"
  detail: string; // supportive reasoning
  confidence: number; // 1-5
}

export function computeVocalEfficiencyReview(
  song: Song,
  rating: Rating | undefined,
  allSongs: Song[],
  allRatings: Rating[],
  options: RecommendationOptions = {}
): VocalEfficiencyReview {
  const currentKey = song.keyNote;

  if (!rating || rating.demand === null || !currentKey) {
    return {
      verdict: 'no-recommendation',
      currentKey,
      suggestedKey: null,
      headline: 'No recommendation yet',
      detail: 'Rate this song’s Vocal Demand and Performance Reliability to unlock a key review.',
      confidence: 1,
    };
  }

  // Reuse the shared candidate ranking so the single-song verdict is
  // consistent with the Recommendations list.
  const candidate = computeKeyReviewCandidates(allSongs, allRatings, options).find(
    (c) => c.songId === song.id
  );

  if (!candidate) {
    return {
      verdict: 'optimal',
      currentKey,
      suggestedKey: null,
      headline: 'Current key appears optimal',
      detail: `Your ratings suggest ${currentKey} is sitting comfortably — no change needed.`,
      confidence: 3,
    };
  }

  if (candidate.suggestedTestKey && candidate.suggestedTestKey !== currentKey) {
    const semitoneDown = transposeKey(currentKey, -1);
    const isLower = candidate.suggestedTestKey === semitoneDown;
    return {
      verdict: isLower ? 'experiment-lower' : 'experiment-specific-key',
      currentKey,
      suggestedKey: candidate.suggestedTestKey,
      headline: isLower
        ? 'Experiment a little lower'
        : `Experiment with ${candidate.suggestedTestKey}`,
      detail: candidate.reason,
      confidence: candidate.confidence,
    };
  }

  return {
    verdict: 'experiment-lower',
    currentKey,
    suggestedKey: transposeKey(currentKey, -1),
    headline: 'Experiment a little lower',
    detail: candidate.reason,
    confidence: candidate.confidence,
  };
}

// ---------------------------------------------------------------------------
// Repertoire suggestion lists (V5 items 5/6)
//
// Each answers one decision question and returns a ranked, capped list. They
// share one shape so the Recommendations screen renders them uniformly.
// ---------------------------------------------------------------------------

export interface SongSuggestion {
  songId: string;
  title: string;
  reason: string;
}

const LIST_LIMIT = 25;

function join(songs: Song[], ratings: Rating[]): Array<{ song: Song; rating: Rating | undefined }> {
  const ratingBySong = new Map(ratings.map((r) => [r.songId, r]));
  return songs.map((s) => ({ song: s, rating: ratingBySong.get(s.id) }));
}

/** Songs the performer is actively learning, surfaced highest-enjoyment first as the natural next focus. */
export function computeSongsToLearnNext(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  return join(songs, ratings)
    .filter((e) => e.rating?.status === 'learning')
    .sort((a, b) => (b.rating?.enjoyment ?? 0) - (a.rating?.enjoyment ?? 0))
    .slice(0, LIST_LIMIT)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: e.rating?.enjoyment ? `Learning · enjoyment ${e.rating.enjoyment}/5` : 'Currently learning',
    }));
}

/**
 * Rediscover (V5 item 6): songs you rate well and clearly enjoy, that still
 * suit your voice, but haven't been played in a long time. Prime candidates to
 * bring back into rotation. Ranked by how long ago they were last played.
 */
export function computeRediscoverSongs(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  return join(songs, ratings)
    .filter((e) => {
      const r = e.rating;
      if (!r || !e.song.lastPlayed) return false;
      const stillSuits = (r.reliability ?? 0) >= 3 || (r.enjoyment ?? 0) >= 4;
      const active = ACTIVE_STATUSES.includes(r.status);
      return active && stillSuits;
    })
    .sort((a, b) => new Date(a.song.lastPlayed!).getTime() - new Date(b.song.lastPlayed!).getTime())
    .slice(0, LIST_LIMIT)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: `Last played ${new Date(e.song.lastPlayed!).toLocaleDateString()} · reliability ${
        e.rating!.reliability ?? '—'
      }/5`,
    }));
}

/**
 * Ready for promotion (V5 item 5): songs marked Learning that you now nail
 * reliably — time to move them into Occasional/Regular rotation.
 */
export function computeSongsReadyForPromotion(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  return join(songs, ratings)
    .filter((e) => e.rating?.status === 'learning' && (e.rating.reliability ?? 0) >= 4)
    .sort((a, b) => (b.rating?.reliability ?? 0) - (a.rating?.reliability ?? 0))
    .slice(0, LIST_LIMIT)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: `Reliability ${e.rating!.reliability}/5 while still Learning — ready to promote`,
    }));
}

/**
 * Needs practice (V5 item 5): songs in active rotation whose reliability is
 * lagging — the priority practice list.
 */
export function computeSongsNeedingPractice(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  return join(songs, ratings)
    .filter((e) => e.rating && ACTIVE_STATUSES.includes(e.rating.status) && (e.rating.reliability ?? 5) <= 2)
    .sort((a, b) => (a.rating?.reliability ?? 5) - (b.rating?.reliability ?? 5))
    .slice(0, LIST_LIMIT)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: `In rotation but reliability ${e.rating!.reliability}/5`,
    }));
}

/**
 * Hidden gems (V5 item 5): songs you clearly enjoy and perform reliably, but
 * that aren't yet in regular rotation (Occasional/Learning/Unexplored) — worth
 * featuring more.
 */
export function computeHiddenGems(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  return join(songs, ratings)
    .filter((e) => {
      const r = e.rating;
      if (!r || r.status === 'regular') return false;
      return (r.enjoyment ?? 0) >= 4 && (r.reliability ?? 0) >= 4;
    })
    .sort(
      (a, b) =>
        (b.rating!.enjoyment ?? 0) + (b.rating!.reliability ?? 0) -
        ((a.rating!.enjoyment ?? 0) + (a.rating!.reliability ?? 0))
    )
    .slice(0, LIST_LIMIT)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: `Enjoyment ${e.rating!.enjoyment}/5 · reliability ${e.rating!.reliability}/5, not yet Regular`,
    }));
}

/**
 * Recovery songs (V5 item 5): reliable, low-fatigue numbers — the songs to
 * reach for right after something demanding, to let the voice settle.
 */
export function computeRecoverySongs(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  return join(songs, ratings)
    .filter((e) => {
      const r = e.rating;
      if (!r || !ACTIVE_STATUSES.includes(r.status)) return false;
      return (r.fatigue ?? 5) <= 2 && (r.reliability ?? 0) >= 4;
    })
    .sort((a, b) => (a.rating!.fatigue ?? 5) - (b.rating!.fatigue ?? 5))
    .slice(0, LIST_LIMIT)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: `Low fatigue (${e.rating!.fatigue}/5), reliable (${e.rating!.reliability}/5) — good recovery`,
    }));
}

/**
 * High-demand songs (V5 items 5/11): the Tough/Challenging numbers. Useful for
 * pacing a set and for spotting Vocal Efficiency Review candidates.
 */
export function computeHighDemandSongs(songs: Song[], ratings: Rating[]): SongSuggestion[] {
  return join(songs, ratings)
    .filter((e) => (e.rating?.demand ?? 0) >= DEMAND_REVIEW_THRESHOLD)
    .sort((a, b) => (b.rating?.demand ?? 0) - (a.rating?.demand ?? 0))
    .slice(0, LIST_LIMIT)
    .map((e) => ({
      songId: e.song.id,
      title: e.song.title,
      reason: e.rating!.demand === 5 ? 'Challenging vocal demand' : 'Tough vocal demand',
    }));
}
