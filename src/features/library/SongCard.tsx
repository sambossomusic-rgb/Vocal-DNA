import type { Song, Artist, Folder, Rating } from '../../types/domain';

interface Props {
  song: Song;
  artist?: Artist;
  folder?: Folder;
  rating?: Rating;
  onOpen: () => void;
}

export function SongCard({ song, artist, folder, rating, onOpen }: Props): JSX.Element {
  const status = rating?.status ?? 'new';

  return (
    <button className="song-card" onClick={onOpen}>
      <div className="song-title">{song.title.trim() || 'Untitled'}</div>
      <div className="song-meta">{artist?.name ?? 'Unknown artist'}</div>
      <div className="song-meta">
        {song.keyNote ? `Key ${song.keyNote}` : 'Key —'}
        {song.bpm ? ` · ${Math.round(song.bpm)} BPM` : ''}
        {folder ? ` · ${folder.name}` : ''}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <span className={`pill pill-status-${status}`}>{status.replace('-', ' ')}</span>
      </div>
    </button>
  );
}
