import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Folder, Track, Rating } from '../../types/domain';
import { RatingForm } from '../rating/RatingForm';
import { TagEditor } from '../tags/TagEditor';

interface Props {
  songId: string;
  onBack: () => void;
}

export function SongDetailView({ songId, onBack }: Props): JSX.Element {
  const dataVersion = useDataVersion();

  const song = useLiveQuery<Song | undefined>(
    () => db.songs.get(songId),
    [songId, dataVersion],
    undefined
  );
  const artist = useLiveQuery<Artist | undefined>(
    async () => (song?.artistId ? db.artists.get(song.artistId) : undefined),
    [song?.artistId, dataVersion],
    undefined
  );
  const folder = useLiveQuery<Folder | undefined>(
    async () => (song?.folderId ? db.folders.get(song.folderId) : undefined),
    [song?.folderId, dataVersion],
    undefined
  );
  const tracks = useLiveQuery<Track[]>(
    () => db.tracks.where('songId').equals(songId).toArray(),
    [songId, dataVersion],
    []
  );
  const rating = useLiveQuery<Rating | undefined>(
    () => db.ratings.get(songId),
    [songId, dataVersion],
    undefined
  );

  if (!song) {
    return (
      <div className="app-content">
        <button className="back-button" onClick={onBack}>
          ‹ Back
        </button>
        <div className="empty-state">Song not found.</div>
      </div>
    );
  }

  return (
    <div className="app-content">
      <button className="back-button" onClick={onBack}>
        ‹ Back to Library
      </button>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
        {song.title.trim() || 'Untitled'}
      </h1>
      <div style={{ color: 'var(--text-dim)', marginTop: 4, marginBottom: 20 }}>
        {artist?.name ?? 'Unknown artist'}
        {folder ? ` · ${folder.name}` : ''}
        {song.year ? ` · ${song.year}` : ''}
      </div>

      <div className="stat-grid" style={{ marginBottom: 8 }}>
        <div className="card">
          <div className="stat-number">{song.keyNote ?? '—'}</div>
          <div className="stat-label">Key</div>
        </div>
        <div className="card">
          <div className="stat-number">{song.bpm ? Math.round(song.bpm) : '—'}</div>
          <div className="stat-label">BPM</div>
        </div>
        <div className="card">
          <div className="stat-number">
            {song.duration ? `${Math.floor(song.duration / 60)}:${String(Math.round(song.duration % 60)).padStart(2, '0')}` : '—'}
          </div>
          <div className="stat-label">Duration</div>
        </div>
        <div className="card">
          <div className="stat-number">{tracks.length}</div>
          <div className="stat-label">Tracks</div>
        </div>
      </div>

      <div className="section-title">Tags</div>
      <div className="card">
        <TagEditor songId={songId} />
      </div>

      <div className="section-title">Your rating</div>
      <div className="card">
        <RatingForm songId={songId} existingRating={rating} />
      </div>

      {tracks.length > 0 && (
        <>
          <div className="section-title">Tracks</div>
          <div className="card">
            {tracks
              .slice()
              .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
              .map((track) => (
                <div
                  key={track.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 14,
                  }}
                >
                  <span>{track.name?.trim() || `Track ${track.number ?? ''}`}</span>
                  <span style={{ color: 'var(--text-dim)' }}>
                    {track.duration ? `${Math.round(track.duration)}s` : ''}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
