import { useState } from 'react';
import type { Song, Artist, RatingValue } from '../../types/domain';
import type { SongPrediction } from '../../analytics/predictionEngine';
import { ScaleButtonGrid } from '../../components/ScaleButtonGrid';

interface Props {
  song: Song;
  artist?: Artist;
  prediction: SongPrediction | null;
  onSave: (demand: RatingValue, reliability: RatingValue) => void;
}

const MID_SCALE: RatingValue = 3;

/** Constitution Priority 5, Pass One — Demand & Reliability only, prefilled from prediction, one tap to accept. */
export function PassOneCard({ song, artist, prediction, onSave }: Props): JSX.Element {
  const [demand, setDemand] = useState<RatingValue>(prediction?.predictedDemand ?? MID_SCALE);
  const [reliability, setReliability] = useState<RatingValue>(prediction?.predictedReliability ?? MID_SCALE);

  const hasPrediction = prediction !== null && prediction.sampleSize > 0;

  return (
    <div>
      <div className="song-title" style={{ fontSize: 22, marginBottom: 4 }}>
        {song.title.trim() || 'Untitled'}
      </div>
      <div className="song-meta" style={{ fontSize: 15, marginBottom: 20 }}>
        {artist?.name ?? 'Unknown artist'}
      </div>

      {hasPrediction && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
          Predicted from {prediction!.sampleSize} previous rating
          {prediction!.sampleSize === 1 ? '' : 's'} — adjust if needed, or just save.
        </div>
      )}

      <ScaleButtonGrid label="Demand" value={demand} onChange={setDemand} />
      <ScaleButtonGrid label="Reliability" value={reliability} onChange={setReliability} />

      <button
        className="button-primary"
        style={{ width: '100%' }}
        onClick={() => onSave(demand, reliability)}
      >
        Save & Next
      </button>
    </div>
  );
}
