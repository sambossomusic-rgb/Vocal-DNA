import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Rating, SongKeyword, RepertoireStatus, RatingValue } from '../../types/domain';
import { createDefaultRating, REPERTOIRE_STATUS_LABELS } from '../../types/domain';
import {
  computeTagLearning,
  computeGlobalLearning,
  computeKeyTransposeAverages,
  predictForSong,
} from '../../analytics/predictionEngine';
import { computeProgress } from '../../analytics/progressEngine';
import { QuickAssessCard } from './QuickAssessCard';
import { PassOneCard } from './PassOneCard';
import { PassTwoCard } from './PassTwoCard';

type Phase = 'status' | 'pass-one' | 'pass-two';

const PHASE_TITLES: Record<Phase, string> = {
  status: 'Status',
  'pass-one': 'Pass One — Demand & Reliability',
  'pass-two': 'Pass Two — Enjoyment & Fatigue',
};

function isInRotation(status: RepertoireStatus): boolean {
  return status === 'regular' || status === 'occasional';
}

/**
 * Constitution Priority 5 — two-stage assessment. Every song first gets a
 * status tap, then (if Regular/Occasional) the WHOLE library goes through
 * Pass One (Demand & Reliability) before Pass Two (Enjoyment & Fatigue)
 * begins for anyone — each pass stays mentally simple by asking only two
 * questions. Phases are derived from live data (never a manual index), so
 * completing the last song in a phase naturally advances to the next phase.
 */
export function AssessView(): JSX.Element {
  const dataVersion = useDataVersion();
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  // Songs completed in this session, keyed "phase:songId" so finishing a
  // song in one phase doesn't suppress it from appearing in a later phase.
  // Needed because `ratings` (below) only reflects a write after its own
  // async refetch resolves, which lags the write by a tick.
  const [locallyDone, setLocallyDone] = useState<Set<string>>(new Set());

  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const artists = useLiveQuery<Artist[]>(() => db.artists.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);
  const songKeywords = useLiveQuery<SongKeyword[]>(() => db.songKeywords.toArray(), [dataVersion], []);

  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const ratingBySongId = useMemo(() => new Map(ratings.map((r) => [r.songId, r])), [ratings]);
  const tagIdsBySongId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of songKeywords) {
      const list = map.get(link.songId) ?? [];
      list.push(link.keywordId);
      map.set(link.songId, list);
    }
    return map;
  }, [songKeywords]);

  function sortByArtistThenTitle(list: Song[]): Song[] {
    return list.slice().sort((a, b) => {
      const artistA = a.artistId ? artistById.get(a.artistId)?.name ?? '' : '';
      const artistB = b.artistId ? artistById.get(b.artistId)?.name ?? '' : '';
      return artistA.localeCompare(artistB) || a.title.localeCompare(b.title);
    });
  }

  const statusQueue = useMemo(
    () =>
      sortByArtistThenTitle(
        songs.filter((s) => !ratingBySongId.has(s.id) && !locallyDone.has(`status:${s.id}`))
      ),
    [songs, ratingBySongId, artistById, locallyDone]
  );
  const passOneQueue = useMemo(
    () =>
      sortByArtistThenTitle(
        songs.filter((s) => {
          const r = ratingBySongId.get(s.id);
          if (!r || !isInRotation(r.status)) return false;
          if (r.demand !== null && r.reliability !== null) return false;
          return !locallyDone.has(`pass-one:${s.id}`);
        })
      ),
    [songs, ratingBySongId, artistById, locallyDone]
  );
  const passTwoQueue = useMemo(
    () =>
      sortByArtistThenTitle(
        songs.filter((s) => {
          const r = ratingBySongId.get(s.id);
          if (!r || !isInRotation(r.status)) return false;
          if (r.demand === null || r.reliability === null) return false; // Pass One not done yet
          if (r.enjoyment !== null && r.fatigue !== null) return false; // Pass Two already done
          return !locallyDone.has(`pass-two:${s.id}`);
        })
      ),
    [songs, ratingBySongId, artistById, locallyDone]
  );

  const phase: Phase = statusQueue.length > 0 ? 'status' : passOneQueue.length > 0 ? 'pass-one' : 'pass-two';
  const currentQueue = phase === 'status' ? statusQueue : phase === 'pass-one' ? passOneQueue : passTwoQueue;

  useEffect(() => {
    if (currentSongId === null && currentQueue.length > 0) {
      setCurrentSongId(currentQueue[0].id);
    }
  }, [currentSongId, currentQueue]);

  const currentSong = currentSongId ? songs.find((s) => s.id === currentSongId) : undefined;

  const progress = useMemo(() => computeProgress(songs.length, ratings), [songs, ratings]);
  const tagLearning = useMemo(() => computeTagLearning(ratings, tagIdsBySongId), [ratings, tagIdsBySongId]);
  const globalLearning = useMemo(() => computeGlobalLearning(ratings), [ratings]);
  const keyTransposeAverages = useMemo(
    () => computeKeyTransposeAverages(songs, ratings),
    [songs, ratings]
  );

  const prediction = useMemo(() => {
    if (!currentSong || phase !== 'pass-one') return null;
    const tagIds = tagIdsBySongId.get(currentSong.id) ?? [];
    return predictForSong(currentSong, tagIds, tagLearning, globalLearning, keyTransposeAverages);
  }, [currentSong, phase, tagIdsBySongId, tagLearning, globalLearning, keyTransposeAverages]);

  function advanceToNext(completedPhase: Phase, completedSongId: string): void {
    setLocallyDone((prev) => new Set(prev).add(`${completedPhase}:${completedSongId}`));
    setCurrentSongId(null);
  }

  async function handleStatusAnswer(status: RepertoireStatus): Promise<void> {
    if (!currentSongId) return;
    const existing = await db.ratings.get(currentSongId);
    const next: Rating = {
      ...(existing ?? createDefaultRating(currentSongId)),
      status,
      ratedAt: new Date().toISOString(),
    };
    await db.ratings.put(next);
    bumpDataVersion();
    advanceToNext('status', currentSongId);
  }

  async function handlePassOneSave(demand: RatingValue, reliability: RatingValue): Promise<void> {
    if (!currentSongId) return;
    const base = (await db.ratings.get(currentSongId)) ?? createDefaultRating(currentSongId);
    const next: Rating = { ...base, demand, reliability, ratedAt: new Date().toISOString() };
    await db.ratings.put(next);
    bumpDataVersion();
    advanceToNext('pass-one', currentSongId);
  }

  async function handlePassTwoSave(enjoyment: RatingValue, fatigue: RatingValue): Promise<void> {
    if (!currentSongId) return;
    const base = (await db.ratings.get(currentSongId)) ?? createDefaultRating(currentSongId);
    const next: Rating = { ...base, enjoyment, fatigue, ratedAt: new Date().toISOString() };
    await db.ratings.put(next);
    bumpDataVersion();
    advanceToNext('pass-two', currentSongId);
  }

  if (songs.length === 0) {
    return (
      <div className="empty-state">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>No songs yet</h2>
        <p>Go to the Import tab and choose a StageTraxx4 (.st4b) file to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 8 }}>
        <div className="card">
          <div className="stat-number">{progress.songsImported}</div>
          <div className="stat-label">Imported</div>
        </div>
        <div className="card">
          <div className="stat-number">{progress.songsAssessed}</div>
          <div className="stat-label">Assessed</div>
        </div>
        <div className="card">
          <div className="stat-number">{statusQueue.length}</div>
          <div className="stat-label">Status remaining</div>
        </div>
        <div className="card">
          <div className="stat-number">{passOneQueue.length}</div>
          <div className="stat-label">Pass One remaining</div>
        </div>
        <div className="card">
          <div className="stat-number">{passTwoQueue.length}</div>
          <div className="stat-label">Pass Two remaining</div>
        </div>
        <div className="card">
          <div className="stat-number">{progress.predictionConfidencePercent}%</div>
          <div className="stat-label">Prediction confidence</div>
        </div>
        <div className="card">
          <div className="stat-number" style={{ fontSize: 20 }}>
            {progress.mostCommonStatus ? REPERTOIRE_STATUS_LABELS[progress.mostCommonStatus] : '—'}
          </div>
          <div className="stat-label">Most common status</div>
        </div>
      </div>

      {!currentSong ? (
        <div className="empty-state">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>All caught up 🎉</h2>
          <p>Every imported song has been assessed through both passes. New imports will show up here.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: 12 }}>
            {PHASE_TITLES[phase]}
          </div>
          {phase === 'status' && (
            <QuickAssessCard
              song={currentSong}
              artist={currentSong.artistId ? artistById.get(currentSong.artistId) : undefined}
              onAnswer={handleStatusAnswer}
            />
          )}
          {phase === 'pass-one' && (
            <PassOneCard
              song={currentSong}
              artist={currentSong.artistId ? artistById.get(currentSong.artistId) : undefined}
              prediction={prediction}
              onSave={handlePassOneSave}
            />
          )}
          {phase === 'pass-two' && (
            <PassTwoCard
              song={currentSong}
              artist={currentSong.artistId ? artistById.get(currentSong.artistId) : undefined}
              onSave={handlePassTwoSave}
            />
          )}
        </div>
      )}
    </div>
  );
}
