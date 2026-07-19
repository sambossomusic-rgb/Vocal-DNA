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
}

export function StatsView({ onNavigateToLibrary }: Props): JSX.Element {
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

      <div className="section-title">Metadata health</div>
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
          Gaps to fix in StageTraxx, then re-sync. Tap a row to open those songs in the Library.
        </p>
        {(() => {
          const h = stats.metadataHealth;
          const rows: Array<{ label: string; ids: string[] }> = [
            { label: 'Missing Key', ids: h.missingKey.map((s) => s.songId) },
            { label: 'Missing BPM', ids: h.missingBpm.map((s) => s.songId) },
            { label: 'Missing artist', ids: h.missingArtist.map((s) => s.songId) },
            { label: 'No folder', ids: h.noFolder.map((s) => s.songId) },
          ];
          const anyIssues =
            rows.some((r) => r.ids.length > 0) || h.duplicateTitles.length > 0;
          if (!anyIssues) {
            return <div style={{ fontSize: 13, color: 'var(--success)' }}>All clear — no metadata gaps. ✓</div>;
          }
          return (
            <>
              {rows.map((r) => (
                <button
                  key={r.label}
                  className="clickable-row"
                  style={{ justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}
                  disabled={r.ids.length === 0}
                  onClick={() => r.ids.length > 0 && onNavigateToLibrary({ songIds: r.ids }, r.label)}
                >
                  <span>{r.label}</span>
                  <span style={{ color: r.ids.length ? 'var(--warning)' : 'var(--text-dim)' }}>{r.ids.length}</span>
                </button>
              ))}
              {h.duplicateTitles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>Duplicate titles ({h.duplicateTitles.length})</div>
                  {h.duplicateTitles.slice(0, 15).map((g) => (
                    <button
                      key={g.title}
                      className="clickable-row"
                      style={{ justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}
                      onClick={() => onNavigateToLibrary({ songIds: g.songIds }, `Duplicates of "${g.title}"`)}
                    >
                      <span style={{ color: 'var(--text-dim)' }}>{g.title}</span>
                      <span>{g.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>
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
