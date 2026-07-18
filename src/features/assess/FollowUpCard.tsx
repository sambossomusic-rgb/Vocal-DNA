import { useState } from 'react';
import type { Song, Artist } from '../../types/domain';
import type { SongPrediction } from '../../analytics/predictionEngine';
import { ScaleSlider } from '../rating/RatingForm';

interface Props {
  song: Song;
  artist?: Artist;
  prediction: SongPrediction | null;
  onSave: (demand: number, reliability: number, transpose: number, notes: string) => void;
}

const MID_SCALE_10 = 5;

/** Constitution Feature 2 + 5 — shown only for Regular/Occasional, prefilled from statistical prediction, one tap to accept. */
export function FollowUpCard({ song, artist, prediction, onSave }: Props): JSX.Element {
  const [demand, setDemand] = useState(prediction?.predictedDemand ?? MID_SCALE_10);
  const [reliability, setReliability] = useState(prediction?.predictedReliability ?? MID_SCALE_10);
  const [transpose, setTranspose] = useState(prediction?.predictedTranspose ?? 0);
  const [notes, setNotes] = useState('');

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

      <ScaleSlider label="Demand" value={demand} onChange={setDemand} max={10} />
      <ScaleSlider label="Reliability" value={reliability} onChange={setReliability} max={10} />

      <div className="slider-row">
        <label style={{ width: 110, fontSize: 14, color: 'var(--text-dim)' }}>Transpose</label>
        <button
          className="button-secondary"
          style={{ padding: '10px 16px' }}
          onClick={() => setTranspose((t) => Math.max(-12, t - 1))}
        >
          −
        </button>
        <div style={{ minWidth: 60, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
          {transpose > 0 ? `+${transpose}` : transpose}
        </div>
        <button
          className="button-secondary"
          style={{ padding: '10px 16px' }}
          onClick={() => setTranspose((t) => Math.min(12, t + 1))}
        >
          +
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>semitones</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>
          Notes
        </label>
        <textarea
          className="text-input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Optional…"
        />
      </div>

      <button
        className="button-primary"
        style={{ width: '100%' }}
        onClick={() => onSave(demand, reliability, transpose, notes)}
      >
        Save & Next
      </button>
    </div>
  );
}
