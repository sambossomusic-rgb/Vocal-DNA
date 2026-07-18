import { useState } from 'react';
import type { Song, Artist, RatingValue } from '../../types/domain';
import { ScaleButtonGrid } from '../../components/ScaleButtonGrid';

interface Props {
  song: Song;
  artist?: Artist;
  onSave: (enjoyment: RatingValue, fatigue: RatingValue) => void;
}

const MID_SCALE: RatingValue = 3;

/** Constitution Priority 5, Pass Two — Enjoyment & Fatigue only, run after every song has completed Pass One. */
export function PassTwoCard({ song, artist, onSave }: Props): JSX.Element {
  const [enjoyment, setEnjoyment] = useState<RatingValue>(MID_SCALE);
  const [fatigue, setFatigue] = useState<RatingValue>(MID_SCALE);

  return (
    <div>
      <div className="song-title" style={{ fontSize: 22, marginBottom: 4 }}>
        {song.title.trim() || 'Untitled'}
      </div>
      <div className="song-meta" style={{ fontSize: 15, marginBottom: 20 }}>
        {artist?.name ?? 'Unknown artist'}
      </div>

      <ScaleButtonGrid label="Enjoyment" value={enjoyment} onChange={setEnjoyment} />
      <ScaleButtonGrid label="Fatigue" value={fatigue} onChange={setFatigue} />

      <button
        className="button-primary"
        style={{ width: '100%' }}
        onClick={() => onSave(enjoyment, fatigue)}
      >
        Save & Next
      </button>
    </div>
  );
}
