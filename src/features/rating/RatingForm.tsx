import { useState } from 'react';
import { db } from '../../db/db';
import { bumpDataVersion } from '../../db/dataVersion';
import type { Rating, SongStatus } from '../../types/domain';
import { SONG_STATUSES } from '../../types/domain';

interface Props {
  songId: string;
  existingRating?: Rating;
}

const DEFAULTS = {
  difficulty: 3,
  confidence: 3,
  enjoyment: 3,
  fatigue: 3,
  transpose: 0,
  status: 'new' as SongStatus,
  notes: '',
};

export function RatingForm({ songId, existingRating }: Props): JSX.Element {
  const [difficulty, setDifficulty] = useState(existingRating?.difficulty ?? DEFAULTS.difficulty);
  const [confidence, setConfidence] = useState(existingRating?.confidence ?? DEFAULTS.confidence);
  const [enjoyment, setEnjoyment] = useState(existingRating?.enjoyment ?? DEFAULTS.enjoyment);
  const [fatigue, setFatigue] = useState(existingRating?.fatigue ?? DEFAULTS.fatigue);
  const [transpose, setTranspose] = useState(existingRating?.transpose ?? DEFAULTS.transpose);
  const [status, setStatus] = useState<SongStatus>(existingRating?.status ?? DEFAULTS.status);
  const [notes, setNotes] = useState(existingRating?.notes ?? DEFAULTS.notes);
  const [saved, setSaved] = useState(false);

  async function handleSave(): Promise<void> {
    const rating: Rating = {
      songId,
      difficulty,
      confidence,
      enjoyment,
      fatigue,
      transpose,
      status,
      notes,
      ratedAt: new Date().toISOString(),
    };
    await db.ratings.put(rating);
    bumpDataVersion();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      <ScaleSlider label="Difficulty" value={difficulty} onChange={setDifficulty} />
      <ScaleSlider label="Confidence" value={confidence} onChange={setConfidence} />
      <ScaleSlider label="Enjoyment" value={enjoyment} onChange={setEnjoyment} />
      <ScaleSlider label="Fatigue" value={fatigue} onChange={setFatigue} />

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

      <div className="slider-row">
        <label style={{ width: 110, fontSize: 14, color: 'var(--text-dim)' }}>Status</label>
        <select
          className="select-input"
          value={status}
          onChange={(e) => setStatus(e.target.value as SongStatus)}
          style={{ flex: 1 }}
        >
          {SONG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('-', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>
          Notes
        </label>
        <textarea
          className="text-input"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Performance notes, cues, reminders…"
        />
      </div>

      <button className="button-primary" onClick={handleSave}>
        {saved ? 'Saved ✓' : 'Save rating'}
      </button>
    </div>
  );
}

interface ScaleSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function ScaleSlider({ label, value, onChange }: ScaleSliderProps): JSX.Element {
  return (
    <div className="slider-row">
      <label style={{ width: 110, fontSize: 14, color: 'var(--text-dim)' }}>{label}</label>
      <input
        className="slider-input"
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div style={{ minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
