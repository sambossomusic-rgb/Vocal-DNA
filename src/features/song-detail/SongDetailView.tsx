import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Folder, Rating } from '../../types/domain';
import { CHROMATIC_NOTES } from '../../types/domain';
import { RatingForm } from '../rating/RatingForm';
import { TagEditor } from '../tags/TagEditor';

interface Props {
  songId: string;
  onBack: () => void;
}

async function stepKey(song: Song, direction: 1 | -1): Promise<void> {
  const currentIndex = song.keyNote ? CHROMATIC_NOTES.indexOf(song.keyNote as (typeof CHROMATIC_NOTES)[number]) : -1;
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + CHROMATIC_NOTES.length) % CHROMATIC_NOTES.length;
  await db.songs.update(song.id, {
    keyNote: CHROMATIC_NOTES[nextIndex],
    updatedAt: new Date().toISOString(),
  });
  bumpDataVersion();
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

      <div className="stat-grid" style={{ marginBottom: 4 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>
            Key
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="button-secondary"
              style={{ padding: '6px 12px', minHeight: 36 }}
              onClick={() => stepKey(song, -1)}
            >
              ▼
            </button>
            <div className="stat-number">{song.keyNote ?? '—'}</div>
            <button
              className="button-secondary"
              style={{ padding: '6px 12px', minHeight: 36 }}
              onClick={() => stepKey(song, 1)}
            >
              ▲
            </button>
          </div>
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
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
        Changing the key here only updates VocalDNA — it never alters your StageTraxx library.
      </div>

      <div className="section-title">Tags</div>
      <div className="card">
        <TagEditor songId={songId} />
      </div>

      <div className="section-title">Your rating</div>
      <div className="card">
        <RatingForm songId={songId} existingRating={rating} />
      </div>
    </div>
  );
}
