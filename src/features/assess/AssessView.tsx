import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Rating, SongKeyword, PerformanceFrequency } from '../../types/domain';
import { createDefaultRating } from '../../types/domain';
import {
  computeTagLearning,
  computeGlobalLearning,
  computeKeyTransposeAverages,
  predictForSong,
} from '../../analytics/predictionEngine';
import { computeProgress } from '../../analytics/progressEngine';
import { QuickAssessCard } from './QuickAssessCard';
import { FollowUpCard } from './FollowUpCard';

const FREQUENCY_LABELS: Record<PerformanceFrequency, string> = {
  regular: '🎤 Regular',
  occasional: '🎵 Occasional',
  learning: '📚 Learning',
  never: '🚫 Never',
};

/**
 * Constitution Features 1, 2, 4, 5, 6 — the fast path through a library.
 * The queue is always "songs with no performanceFrequency yet", recomputed
 * from live data, so answering a song naturally advances to the next one
 * without any manual index bookkeeping.
 */
export function AssessView(): JSX.Element {
  const dataVersion = useDataVersion();
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [stage, setStage] = useState<'quick' | 'followup'>('quick');
  // Songs answered in this session, tracked locally so the queue drops them
  // immediately. `ratings` (below) only reflects a write after its own
  // async refetch resolves, which lags the write by a tick — relying on it
  // alone would let the just-answered song reappear for one render.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());

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

  const queue = useMemo(() => {
    return songs
      .filter((song) => !answeredIds.has(song.id) && !ratingBySongId.get(song.id)?.performanceFrequency)
      .sort((a, b) => {
        const artistA = a.artistId ? artistById.get(a.artistId)?.name ?? '' : '';
        const artistB = b.artistId ? artistById.get(b.artistId)?.name ?? '' : '';
        return artistA.localeCompare(artistB) || a.title.localeCompare(b.title);
      });
  }, [songs, ratingBySongId, artistById, answeredIds]);

  useEffect(() => {
    if (currentSongId === null && queue.length > 0) {
      setCurrentSongId(queue[0].id);
      setStage('quick');
    }
  }, [currentSongId, queue]);

  const currentSong = currentSongId ? songs.find((s) => s.id === currentSongId) : undefined;

  const progress = useMemo(() => computeProgress(songs.length, ratings), [songs, ratings]);
  const tagLearning = useMemo(() => computeTagLearning(ratings, tagIdsBySongId), [ratings, tagIdsBySongId]);
  const globalLearning = useMemo(() => computeGlobalLearning(ratings), [ratings]);
  const keyTransposeAverages = useMemo(
    () => computeKeyTransposeAverages(songs, ratings),
    [songs, ratings]
  );

  const prediction = useMemo(() => {
    if (!currentSong) return null;
    const tagIds = tagIdsBySongId.get(currentSong.id) ?? [];
    return predictForSong(currentSong, tagIds, tagLearning, globalLearning, keyTransposeAverages);
  }, [currentSong, tagIdsBySongId, tagLearning, globalLearning, keyTransposeAverages]);

  function advanceToNext(completedSongId: string): void {
    setAnsweredIds((prev) => new Set(prev).add(completedSongId));
    setCurrentSongId(null);
    setStage('quick');
  }

  async function handleQuickAnswer(frequency: PerformanceFrequency): Promise<void> {
    if (!currentSongId) return;
    const existing = await db.ratings.get(currentSongId);
    const next: Rating = {
      ...(existing ?? createDefaultRating(currentSongId)),
      performanceFrequency: frequency,
      ratedAt: new Date().toISOString(),
    };
    await db.ratings.put(next);
    bumpDataVersion();

    if (frequency === 'regular' || frequency === 'occasional') {
      setStage('followup');
    } else {
      advanceToNext(currentSongId);
    }
  }

  async function handleFollowUpSave(
    demand: number,
    reliability: number,
    transpose: number,
    notes: string
  ): Promise<void> {
    if (!currentSongId) return;
    const existing = await db.ratings.get(currentSongId);
    const base = existing ?? createDefaultRating(currentSongId);
    const next: Rating = {
      ...base,
      demand,
      reliability,
      transpose,
      notes: notes.trim() ? notes : base.notes,
      ratedAt: new Date().toISOString(),
    };
    await db.ratings.put(next);
    bumpDataVersion();
    advanceToNext(currentSongId);
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
          <div className="stat-number">{progress.songsRemaining}</div>
          <div className="stat-label">Remaining</div>
        </div>
        <div className="card">
          <div className="stat-number">{progress.predictionConfidencePercent}%</div>
          <div className="stat-label">Prediction confidence</div>
        </div>
        <div className="card">
          <div className="stat-number" style={{ fontSize: 20 }}>
            {progress.mostCommonFrequency ? FREQUENCY_LABELS[progress.mostCommonFrequency] : '—'}
          </div>
          <div className="stat-label">Most common status</div>
        </div>
      </div>

      {!currentSong ? (
        <div className="empty-state">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>All caught up 🎉</h2>
          <p>Every imported song has been assessed. New imports will show up here.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          {stage === 'quick' ? (
            <QuickAssessCard
              song={currentSong}
              artist={currentSong.artistId ? artistById.get(currentSong.artistId) : undefined}
              onAnswer={handleQuickAnswer}
            />
          ) : (
            <FollowUpCard
              song={currentSong}
              artist={currentSong.artistId ? artistById.get(currentSong.artistId) : undefined}
              prediction={prediction}
              onSave={handleFollowUpSave}
            />
          )}
        </div>
      )}
    </div>
  );
}
