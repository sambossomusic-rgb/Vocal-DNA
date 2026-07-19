import { useMemo } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Rating } from '../../types/domain';
import {
  computeKeyReviewCandidates,
  computeRediscoverSongs,
} from '../../analytics/recommendationEngine';
import { computeStats } from '../../analytics/statsEngine';
import type { FilterState } from '../library/FilterPanel';
import type { InsightsTab } from '../insights/InsightsView';

interface Props {
  onOpenSong: (songId: string, contextIds: string[]) => void;
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
  onGoToAssess: () => void;
  onGoToInsights: (tab: InsightsTab) => void;
}

/**
 * Home (V5 item 1) — the new default screen. It answers one question: "What
 * should I do today?" Every card is a decision or an action, never a raw stat
 * dump. This is the intelligent-companion front door; the database lives one
 * tap deeper in Library and Insights.
 */
export function HomeView({ onOpenSong, onNavigateToLibrary, onGoToAssess, onGoToInsights }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);

  const ratingBySong = useMemo(() => new Map(ratings.map((r) => [r.songId, r])), [ratings]);
  const assessedCount = ratings.length;
  const unexploredCount = songs.filter((s) => (ratingBySong.get(s.id)?.status ?? 'unexplored') === 'unexplored').length;

  const keyReviews = useMemo(() => computeKeyReviewCandidates(songs, ratings), [songs, ratings]);
  const rediscover = useMemo(() => computeRediscoverSongs(songs, ratings), [songs, ratings]);

  const healthGaps = useMemo(() => {
    if (songs.length === 0) return 0;
    const h = computeStats(songs, [], [], ratings).metadataHealth;
    return (
      h.missingKey.length + h.missingBpm.length + h.missingArtist.length + h.noFolder.length + h.duplicateTitles.length
    );
  }, [songs, ratings]);

  if (songs.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Welcome to VocalDNA</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 0, marginBottom: 20 }}>
          Your performance companion for your repertoire — 100% on this device.
        </p>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Get started</div>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 0 }}>
            Open Assess and use Sync to load a StageTraxx4 (.st4b) file. Nothing is uploaded — it stays here.
          </p>
          <button className="button-primary" onClick={onGoToAssess}>
            Go to Assess &amp; Sync
          </button>
        </div>
      </div>
    );
  }

  const assessedPct = Math.round((assessedCount / songs.length) * 100);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>What should I do today?</h1>
      <p style={{ color: 'var(--text-dim)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Your repertoire at a glance, with the next useful move surfaced for you.
      </p>

      {/* Snapshot */}
      <div className="stat-grid" style={{ marginBottom: 8 }}>
        <button className="card clickable-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }} onClick={() => onNavigateToLibrary({}, undefined)}>
          <div className="stat-number">{songs.length}</div>
          <div className="stat-label">Songs in library</div>
        </button>
        <button
          className="card clickable-row"
          style={{ flexDirection: 'column', alignItems: 'flex-start' }}
          onClick={() => onGoToInsights('repertoire')}
        >
          <div className="stat-number">{assessedCount}</div>
          <div className="stat-label">Songs assessed ({assessedPct}%)</div>
        </button>
      </div>

      {/* Continue assessing */}
      <div className="section-title">Continue assessing</div>
      <div className="card">
        {unexploredCount > 0 ? (
          <>
            <p style={{ fontSize: 14, marginTop: 0, marginBottom: 12 }}>
              <strong>{unexploredCount}</strong> song{unexploredCount === 1 ? '' : 's'} not yet assessed. A few quick
              taps each keeps your recommendations sharp.
            </p>
            <button className="button-primary" onClick={onGoToAssess}>
              Continue assessing →
            </button>
          </>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--success)' }}>
            Every song is assessed. 🎉 Reassess anytime from Assess.
          </div>
        )}
      </div>

      {/* Vocal Efficiency Review */}
      <HomeActionCard
        title="Vocal Efficiency Review"
        count={keyReviews.length}
        emptyText="No songs flagged for a key review — your keys look comfortable."
        blurb={
          keyReviews.length > 0
            ? `${keyReviews.length} song${keyReviews.length === 1 ? '' : 's'} might sit more comfortably in another key.`
            : ''
        }
        actionLabel="Review keys"
        onAction={() => onGoToInsights('recommendations')}
        preview={keyReviews.slice(0, 3).map((r) => ({
          songId: r.songId,
          title: r.title,
          detail: `${r.currentKey}${r.suggestedTestKey && r.suggestedTestKey !== r.currentKey ? ` → try ${r.suggestedTestKey}` : ''}`,
          ids: keyReviews.map((c) => c.songId),
        }))}
        onOpenSong={onOpenSong}
      />

      {/* Rediscover */}
      <HomeActionCard
        title="Rediscover songs"
        count={rediscover.length}
        emptyText="Nothing to rediscover right now."
        blurb={
          rediscover.length > 0
            ? 'Songs you rate well but haven’t played in a while — worth bringing back.'
            : ''
        }
        actionLabel="See all"
        onAction={() => onGoToInsights('recommendations')}
        preview={rediscover.slice(0, 3).map((r) => ({
          songId: r.songId,
          title: r.title,
          detail: r.reason,
          ids: rediscover.map((c) => c.songId),
        }))}
        onOpenSong={onOpenSong}
      />

      {/* Library health */}
      <div className="section-title">Library health</div>
      <button
        className="card clickable-row"
        style={{ justifyContent: 'space-between', width: '100%' }}
        onClick={() => onGoToInsights('health')}
      >
        <span style={{ fontSize: 14 }}>
          {healthGaps > 0 ? `${healthGaps} metadata gap${healthGaps === 1 ? '' : 's'} to tidy in StageTraxx` : 'No metadata gaps — all clear ✓'}
        </span>
        <span style={{ color: healthGaps > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
          {healthGaps > 0 ? healthGaps : '✓'}
        </span>
      </button>

      {/* Quick access */}
      <div className="section-title">Explore</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="button-secondary" onClick={() => onNavigateToLibrary({}, undefined)}>
          Open Library
        </button>
        <button className="button-secondary" onClick={() => onGoToInsights('voice')}>
          Open Insights
        </button>
      </div>
    </div>
  );
}

interface PreviewRow {
  songId: string;
  title: string;
  detail: string;
  ids: string[];
}

function HomeActionCard({
  title,
  count,
  blurb,
  emptyText,
  actionLabel,
  onAction,
  preview,
  onOpenSong,
}: {
  title: string;
  count: number;
  blurb: string;
  emptyText: string;
  actionLabel: string;
  onAction: () => void;
  preview: PreviewRow[];
  onOpenSong: (songId: string, contextIds: string[]) => void;
}): JSX.Element {
  return (
    <>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>{title}{count > 0 ? ` (${count})` : ''}</span>
        {count > 0 && (
          <button className="button-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }} onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
      <div className="card">
        {count === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{emptyText}</div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0, marginBottom: 10 }}>{blurb}</p>
            {preview.map((row) => (
              <button
                key={row.songId}
                className="clickable-row"
                style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}
                onClick={() => onOpenSong(row.songId, row.ids)}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{row.title.trim() || 'Untitled'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8, textAlign: 'right' }}>{row.detail}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );
}
