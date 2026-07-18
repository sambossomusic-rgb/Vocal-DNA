import { useMemo } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Folder, Rating } from '../../types/domain';
import { REPERTOIRE_STATUS_LABELS, metricLabel } from '../../types/domain';
import { computeStats } from '../../analytics/statsEngine';
import type { FilterState } from '../library/FilterPanel';

interface Props {
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
  onOpenSong: (songId: string, contextIds: string[]) => void;
}

export function StatsView({ onNavigateToLibrary, onOpenSong }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const artists = useLiveQuery<Artist[]>(() => db.artists.toArray(), [dataVersion], []);
  const folders = useLiveQuery<Folder[]>(() => db.folders.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);

  const stats = useMemo(
    () => computeStats(songs, artists, folders, ratings),
    [songs, artists, folders, ratings]
  );

  if (songs.length === 0) {
    return <div className="empty-state">Import a library to see statistics.</div>;
  }

  const maxFolderCount = Math.max(1, ...stats.songsPerFolder.map((f) => f.count));
  const maxKeyCount = Math.max(1, ...stats.keyDistribution.map((k) => k.count));

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Statistics</h1>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-number">{stats.totalSongs}</div>
          <div className="stat-label">Songs</div>
        </div>
        <div className="card">
          <div className="stat-number">{stats.totalArtists}</div>
          <div className="stat-label">Artists</div>
        </div>
        <div className="card">
          <div className="stat-number">{stats.totalFolders}</div>
          <div className="stat-label">Folders</div>
        </div>
        <div className="card">
          <div className="stat-number">{stats.averageBpm ? Math.round(stats.averageBpm) : '—'}</div>
          <div className="stat-label">Avg BPM</div>
        </div>
        <div className="card">
          <div className="stat-number">{Math.round(stats.ratingCoverage.percentRated)}%</div>
          <div className="stat-label">Songs rated</div>
        </div>
      </div>

      <div className="section-title">Average ratings (across rated songs)</div>
      <div className="stat-grid">
        <RatingAvgCard label={metricLabel('demand')} value={stats.averageRatings.demand} />
        <RatingAvgCard label={metricLabel('reliability')} value={stats.averageRatings.reliability} />
        <RatingAvgCard label="Enjoyment" value={stats.averageRatings.enjoyment} />
        <RatingAvgCard label="Fatigue" value={stats.averageRatings.fatigue} />
      </div>

      <div className="section-title">Songs per folder</div>
      <div className="card">
        {stats.songsPerFolder.map((f) => (
          <button
            key={f.folderName}
            className="clickable-row bar-row"
            onClick={() => onNavigateToLibrary({ folderId: f.folderId }, f.folderName)}
          >
            <div style={{ width: 140, fontSize: 13, color: 'var(--text-dim)' }}>{f.folderName}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(f.count / maxFolderCount) * 100}%` }}
              />
            </div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{f.count}</div>
          </button>
        ))}
      </div>

      <div className="section-title">Key distribution</div>
      <div className="card">
        {stats.keyDistribution.map((k) => (
          <button
            key={k.key}
            className="clickable-row bar-row"
            onClick={() => onNavigateToLibrary({ keyNote: k.key }, `Key ${k.key}`)}
          >
            <div style={{ width: 32, fontSize: 13, color: 'var(--text-dim)' }}>{k.key}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(k.count / maxKeyCount) * 100}%` }} />
            </div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{k.count}</div>
          </button>
        ))}
      </div>

      <div className="section-title">Rating status breakdown</div>
      <div className="card">
        {stats.statusDistribution.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No songs rated yet.</div>
        )}
        {stats.statusDistribution.map((s) => (
          <button
            key={s.status}
            className="clickable-row"
            style={{ justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
            onClick={() => onNavigateToLibrary({ status: s.status }, REPERTOIRE_STATUS_LABELS[s.status])}
          >
            <span className={`pill pill-status-${s.status}`}>{REPERTOIRE_STATUS_LABELS[s.status]}</span>
            <span>{s.count}</span>
          </button>
        ))}
      </div>

      <div className="section-title">Top artists</div>
      <div className="card">
        {stats.topArtistsBySongCount.map((a) => (
          <button
            key={a.artistId}
            className="clickable-row"
            style={{ justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
            onClick={() => onNavigateToLibrary({ artistId: a.artistId }, a.artistName)}
          >
            <span>{a.artistName}</span>
            <span style={{ color: 'var(--text-dim)' }}>{a.count} songs</span>
          </button>
        ))}
      </div>

      {stats.missingMetadata.length > 0 && (
        <>
          <div
            className="section-title"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <span>Metadata needing completion ({stats.missingMetadata.length})</span>
            <button
              className="button-secondary"
              style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
              onClick={() =>
                onNavigateToLibrary(
                  { songIds: stats.missingMetadata.map((m) => m.songId) },
                  'Metadata needing completion'
                )
              }
            >
              View all in Library
            </button>
          </div>
          <div className="card">
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
              Missing Key or BPM — fix these in StageTraxx, then re-import.
            </p>
            {stats.missingMetadata.slice(0, 20).map((m) => (
              <button
                key={m.songId}
                className="clickable-row"
                style={{ justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
                onClick={() => onOpenSong(m.songId, stats.missingMetadata.map((x) => x.songId))}
              >
                <span>
                  {m.title} — {m.artistName}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>
                  {[m.missingKey ? 'Key' : null, m.missingBpm ? 'BPM' : null].filter(Boolean).join(', ')}
                </span>
              </button>
            ))}
            {stats.missingMetadata.length > 20 && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                +{stats.missingMetadata.length - 20} more — use "View all in Library" above.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RatingAvgCard({ label, value }: { label: string; value: number | null }): JSX.Element {
  return (
    <div className="card">
      <div className="stat-number">{value ? value.toFixed(1) : '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
