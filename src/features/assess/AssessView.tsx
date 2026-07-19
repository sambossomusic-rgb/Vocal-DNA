import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { saveRating } from '../../db/saveRating';
import { bumpDataVersion } from '../../db/dataVersion';
import type { Rating, AssessMetric } from '../../types/domain';
import { createDefaultRating, ASSESS_METRICS } from '../../types/domain';
import { computeTagLearning, computeGlobalLearning, predictForSong } from '../../analytics/predictionEngine';
import { FilterPanel, type FilterState, EMPTY_FILTERS } from '../library/FilterPanel';
import { useLibraryData } from '../library/useLibraryData';
import { SyncWizard } from '../import/SyncWizard';
import { MetricToggles } from './MetricToggles';
import { AssessCard, type AssessPatch } from './AssessCard';

export function AssessView(): JSX.Element {
  const [mode, setMode] = useState<'assess' | 'sync'>('assess');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [metrics, setMetrics] = useState<Set<AssessMetric>>(new Set(ASSESS_METRICS));
  const [index, setIndex] = useState(0);

  const {
    songs,
    artists,
    folders,
    playlists,
    tags,
    ratings,
    artistById,
    tagIdsBySongId,
    availableKeys,
    applyFilters,
  } = useLibraryData();

  const queue = useMemo(() => applyFilters(search, filters), [applyFilters, search, filters]);

  const tagLearning = useMemo(() => computeTagLearning(ratings, tagIdsBySongId), [ratings, tagIdsBySongId]);
  const globalLearning = useMemo(() => computeGlobalLearning(ratings), [ratings]);
  const ratingBySongId = useMemo(() => new Map(ratings.map((r) => [r.songId, r])), [ratings]);

  const current = index < queue.length ? queue[index] : undefined;
  const prediction = useMemo(() => {
    if (!current) return null;
    const tagIds = tagIdsBySongId.get(current.id) ?? [];
    return predictForSong(current, tagIds, tagLearning, globalLearning);
  }, [current, tagIdsBySongId, tagLearning, globalLearning]);

  // Editing the collection restarts the walk from the top of the new set.
  function changeFilters(next: FilterState): void {
    setFilters(next);
    setIndex(0);
  }
  function changeSearch(next: string): void {
    setSearch(next);
    setIndex(0);
  }

  async function commit(patch: AssessPatch, delta: number): Promise<void> {
    if (!current) return;
    const base = (await db.ratings.get(current.id)) ?? createDefaultRating(current.id);
    const nextRating: Rating = { ...base, ratedAt: new Date().toISOString() };
    if (patch.status !== undefined) nextRating.status = patch.status;
    if (patch.demand !== undefined) nextRating.demand = patch.demand;
    if (patch.reliability !== undefined) nextRating.reliability = patch.reliability;
    if (patch.enjoyment !== undefined) nextRating.enjoyment = patch.enjoyment;
    if (patch.fatigue !== undefined) nextRating.fatigue = patch.fatigue;

    // Instrumental flag first, so the history snapshot inside saveRating
    // reads the up-to-date song.
    if ((current.isInstrumental ?? false) !== patch.isInstrumental) {
      await db.songs.update(current.id, {
        isInstrumental: patch.isInstrumental,
        updatedAt: new Date().toISOString(),
      });
    }
    await saveRating(nextRating);

    bumpDataVersion();
    setIndex((i) => Math.max(0, Math.min(queue.length, i + delta)));
  }

  if (mode === 'sync') {
    return (
      <div>
        <ModeSwitch mode={mode} onChange={setMode} />
        <SyncWizard onDone={() => setMode('assess')} />
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div>
        <ModeSwitch mode={mode} onChange={setMode} />
        <div className="empty-state">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>No songs yet</h2>
          <p>Tap Sync above and choose a StageTraxx4 (.st4b) file to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ModeSwitch mode={mode} onChange={setMode} />

      <FilterPanel
        artists={artists}
        folders={folders}
        playlists={playlists}
        availableKeys={availableKeys}
        tags={tags}
        value={filters}
        onChange={changeFilters}
      />

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <input
          className="text-input"
          placeholder="Search by title or artist…"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          style={{ fontSize: 16 }}
        />
      </div>

      <div className="section-title" style={{ marginTop: 8 }}>
        Metrics to assess
      </div>
      <MetricToggles selected={metrics} onChange={setMetrics} />

      <div className="section-title">
        {queue.length} song{queue.length === 1 ? '' : 's'} in this collection
      </div>

      {queue.length === 0 ? (
        <div className="empty-state">No songs match the current filters.</div>
      ) : metrics.size === 0 ? (
        <div className="empty-state">Choose at least one metric to assess.</div>
      ) : current ? (
        <div className="card">
          <AssessCard
            key={current.id}
            song={current}
            artist={current.artistId ? artistById.get(current.artistId) : undefined}
            rating={ratingBySongId.get(current.id)}
            metrics={metrics}
            prediction={prediction}
            index={index}
            total={queue.length}
            onCommit={commit}
          />
        </div>
      ) : (
        <div className="empty-state">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Done 🎉</h2>
          <p>Assessed all {queue.length} songs in this collection.</p>
          <button className="button-secondary" style={{ marginTop: 12 }} onClick={() => setIndex(0)}>
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: 'assess' | 'sync'; onChange: (m: 'assess' | 'sync') => void }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      <button
        className={`tab-button ${mode === 'assess' ? 'active' : ''}`}
        style={{ flex: '0 0 auto', padding: '10px 20px' }}
        onClick={() => onChange('assess')}
      >
        Assess
      </button>
      <button
        className={`tab-button ${mode === 'sync' ? 'active' : ''}`}
        style={{ flex: '0 0 auto', padding: '10px 20px' }}
        onClick={() => onChange('sync')}
      >
        Sync
      </button>
    </div>
  );
}
