import { useMemo } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Folder, Rating } from '../../types/domain';
import { computeStats } from '../../analytics/statsEngine';

export function StatsView(): JSX.Element {
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
        <RatingAvgCard label="Difficulty" value={stats.averageRatings.difficulty} />
        <RatingAvgCard label="Confidence" value={stats.averageRatings.confidence} />
        <RatingAvgCard label="Enjoyment" value={stats.averageRatings.enjoyment} />
        <RatingAvgCard label="Fatigue" value={stats.averageRatings.fatigue} />
      </div>

      <div className="section-title">Songs per folder</div>
      <div className="card">
        {stats.songsPerFolder.map((f) => (
          <div className="bar-row" key={f.folderName}>
            <div style={{ width: 140, fontSize: 13, color: 'var(--text-dim)' }}>{f.folderName}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(f.count / maxFolderCount) * 100}%` }}
              />
            </div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{f.count}</div>
          </div>
        ))}
      </div>

      <div className="section-title">Key distribution</div>
      <div className="card">
        {stats.keyDistribution.map((k) => (
          <div className="bar-row" key={k.key}>
            <div style={{ width: 32, fontSize: 13, color: 'var(--text-dim)' }}>{k.key}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(k.count / maxKeyCount) * 100}%` }} />
            </div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{k.count}</div>
          </div>
        ))}
      </div>

      <div className="section-title">Rating status breakdown</div>
      <div className="card">
        {stats.statusDistribution.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No songs rated yet.</div>
        )}
        {stats.statusDistribution.map((s) => (
          <div
            key={s.status}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
          >
            <span className={`pill pill-status-${s.status}`}>{s.status.replace('-', ' ')}</span>
            <span>{s.count}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Top artists</div>
      <div className="card">
        {stats.topArtistsBySongCount.map((a) => (
          <div
            key={a.artistName}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
          >
            <span>{a.artistName}</span>
            <span style={{ color: 'var(--text-dim)' }}>{a.count} songs</span>
          </div>
        ))}
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
