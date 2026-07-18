import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Folder, Rating } from '../../types/domain';
import { CHROMATIC_NOTES } from '../../types/domain';
import { SongEditor } from './SongEditor';
import { TagEditor } from '../tags/TagEditor';

interface Props {
  songId: string;
  contextIds: string[]; // the ordered list this song was opened from (for Prev/Next)
  onNavigate: (songId: string) => void;
  onBack: () => void;
}

interface LoadedData {
  song: Song | null;
  artist?: Artist;
  folder?: Folder;
  rating?: Rating;
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

export function SongDetailView({ songId, contextIds, onNavigate, onBack }: Props): JSX.Element {
  const dataVersion = useDataVersion();

  // One combined query so the editor never initialises from a half-loaded
  // state (a separate async rating query could arrive after the editor mounts
  // and silently drop an existing rating). `null` means "still loading".
  const data = useLiveQuery<LoadedData | null>(
    async () => {
      const song = await db.songs.get(songId);
      if (!song) return { song: null };
      const artist = song.artistId ? await db.artists.get(song.artistId) : undefined;
      const folder = song.folderId ? await db.folders.get(song.folderId) : undefined;
      const rating = await db.ratings.get(songId);
      return { song, artist, folder, rating };
    },
    [songId, dataVersion],
    null
  );

  const currentIndex = contextIds.indexOf(songId);
  const prevId = currentIndex > 0 ? contextIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < contextIds.length - 1 ? contextIds[currentIndex + 1] : null;
  const position = currentIndex >= 0 ? `${currentIndex + 1} of ${contextIds.length}` : null;

  if (data === null) {
    return (
      <div className="app-content">
        <button className="back-button" onClick={onBack}>
          ‹ Back
        </button>
      </div>
    );
  }

  if (data.song === null) {
    return (
      <div className="app-content">
        <button className="back-button" onClick={onBack}>
          ‹ Back
        </button>
        <div className="empty-state">Song not found.</div>
      </div>
    );
  }

  const { song, artist, folder, rating } = data;

  return (
    <div className="app-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="back-button" onClick={onBack}>
          ‹ Back to list
        </button>
        {position && <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{position}</span>}
      </div>

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
        <SongEditor
          key={songId}
          song={song}
          rating={rating}
          prevId={prevId}
          nextId={nextId}
          onNavigate={onNavigate}
          onBack={onBack}
        />
      </div>
    </div>
  );
}
