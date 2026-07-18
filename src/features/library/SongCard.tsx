import type { Song, Artist, Folder, Rating } from '../../types/domain';
import { REPERTOIRE_STATUS_LABELS } from '../../types/domain';

interface Props {
  song: Song;
  artist?: Artist;
  folder?: Folder;
  rating?: Rating;
  selectMode?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onToggleSelect?: () => void;
}

export function SongCard({
  song,
  artist,
  folder,
  rating,
  selectMode = false,
  selected = false,
  onOpen,
  onToggleSelect,
}: Props): JSX.Element {
  const status = rating?.status ?? 'unexplored';

  return (
    <button
      className={`song-card ${selected ? 'song-card-selected' : ''}`}
      onClick={selectMode ? onToggleSelect : onOpen}
    >
      {selectMode && (
        <div className={`song-card-checkmark ${selected ? 'song-card-checkmark-checked' : ''}`}>
          {selected ? '✓' : ''}
        </div>
      )}
      <div className="song-title">{song.title.trim() || 'Untitled'}</div>
      <div className="song-meta">{artist?.name ?? 'Unknown artist'}</div>
      <div className="song-meta">
        {song.keyNote ? `Key ${song.keyNote}` : 'Key —'}
        {song.bpm ? ` · ${Math.round(song.bpm)} BPM` : ''}
        {folder ? ` · ${folder.name}` : ''}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <span className={`pill pill-status-${status}`}>{REPERTOIRE_STATUS_LABELS[status]}</span>
      </div>
    </button>
  );
}
