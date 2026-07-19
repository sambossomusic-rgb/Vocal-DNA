import type { Song, Rating } from '../types/domain';
import {
  computeVocalEfficiencyReview,
  type VocalEfficiencyReview,
} from './recommendationEngine';

/**
 * Song Coach (V5 item 4). PURE and STATISTICAL — turns one song's ratings into
 * practical, plain-language performance advice instead of raw numbers. It
 * answers "what does this song mean for my set?", never "here are your
 * scores". No AI, no UI imports, no DB access.
 *
 * The coach reads the same Vocal Efficiency Review the Recommendations screen
 * uses, so a song's key advice is consistent everywhere it appears.
 */

export type CoachTone = 'positive' | 'suggestion' | 'info';

export interface CoachInsight {
  kind: string;
  tone: CoachTone;
  icon: string;
  title: string;
  message: string;
}

export interface SongCoachResult {
  insights: CoachInsight[];
  efficiency: VocalEfficiencyReview;
  hasRating: boolean;
}

export function computeSongCoach(
  song: Song,
  rating: Rating | undefined,
  allSongs: Song[],
  allRatings: Rating[]
): SongCoachResult {
  const efficiency = computeVocalEfficiencyReview(song, rating, allSongs, allRatings);
  const insights: CoachInsight[] = [];

  if (!rating || (rating.demand === null && rating.reliability === null && rating.enjoyment === null && rating.fatigue === null)) {
    return { insights, efficiency, hasRating: false };
  }

  const { demand, reliability, enjoyment, fatigue, status } = rating;

  // High Vocal Demand — a number to place carefully in the set.
  if (demand !== null && demand >= 4) {
    insights.push({
      kind: 'high-demand',
      tone: 'info',
      icon: '🔥',
      title: demand === 5 ? 'Challenging vocal demand' : 'Tough vocal demand',
      message: 'Give your voice room around this one — avoid stacking it with other demanding numbers.',
    });
  }

  // Excellent Reliability — a song you can lean on.
  if (reliability !== null && reliability >= 4) {
    insights.push({
      kind: 'reliable',
      tone: 'positive',
      icon: '✅',
      title: reliability === 5 ? 'Rock-solid reliability' : 'Reliable in performance',
      message: 'One you can count on — good for high-pressure moments in the set.',
    });
  }

  // Strong Opening Song — reliable, enjoyable, not exhausting.
  if (
    reliability !== null &&
    reliability >= 4 &&
    enjoyment !== null &&
    enjoyment >= 4 &&
    (fatigue === null || fatigue <= 3)
  ) {
    insights.push({
      kind: 'opener',
      tone: 'positive',
      icon: '🎬',
      title: 'Strong opening song',
      message: 'Reliable and enjoyable without tiring your voice — a confident way to open a set.',
    });
  }

  // Suitable Recovery Song — low fatigue, dependable.
  if (fatigue !== null && fatigue <= 2 && reliability !== null && reliability >= 4) {
    insights.push({
      kind: 'recovery',
      tone: 'positive',
      icon: '🌿',
      title: 'Good recovery song',
      message: 'Easy on the voice and dependable — reach for this right after something demanding.',
    });
  }

  // Learning Progress — where a Learning song stands.
  if (status === 'learning') {
    if (reliability !== null && reliability >= 4) {
      insights.push({
        kind: 'learning-progress',
        tone: 'positive',
        icon: '📈',
        title: 'Ready to promote',
        message: 'You’re nailing this reliably — consider moving it out of Learning into rotation.',
      });
    } else {
      insights.push({
        kind: 'learning-progress',
        tone: 'info',
        icon: '📚',
        title: 'Still learning',
        message:
          reliability !== null
            ? `Reliability ${reliability}/5 so far — keep practising toward a confident performance.`
            : 'Rate its Performance Reliability to track how close it is to being gig-ready.',
      });
    }
  }

  return { insights, efficiency, hasRating: true };
}
