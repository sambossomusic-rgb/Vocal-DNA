import { useState } from 'react';
import { db } from '../../db/db';
import { bumpDataVersion } from '../../db/dataVersion';
import type { Rating, RepertoireStatus, RatingValue } from '../../types/domain';
import { createDefaultRating } from '../../types/domain';
import { ScaleButtonGrid } from '../../components/ScaleButtonGrid';
import { StatusPicker } from '../../components/StatusPicker';

interface Props {
  songId: string;
  existingRating?: Rating;
}

export function RatingForm({ songId, existingRating }: Props): JSX.Element {
  const defaults = createDefaultRating(songId);
  const [demand, setDemand] = useState<RatingValue | null>(existingRating?.demand ?? defaults.demand);
  const [reliability, setReliability] = useState<RatingValue | null>(
    existingRating?.reliability ?? defaults.reliability
  );
  const [enjoyment, setEnjoyment] = useState<RatingValue | null>(existingRating?.enjoyment ?? defaults.enjoyment);
  const [fatigue, setFatigue] = useState<RatingValue | null>(existingRating?.fatigue ?? defaults.fatigue);
  const [transpose, setTranspose] = useState(existingRating?.transpose ?? defaults.transpose);
  const [status, setStatus] = useState<RepertoireStatus>(existingRating?.status ?? defaults.status);
  const [notes, setNotes] = useState(existingRating?.notes ?? defaults.notes);
  const [saved, setSaved] = useState(false);

  async function handleSave(): Promise<void> {
    const rating: Rating = {
      songId,
      demand,
      reliability,
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
      <div className="section-title" style={{ marginTop: 0 }}>
        Status
      </div>
      <StatusPicker value={status} onChange={setStatus} />

      <div className="section-title">Pass One — Demand &amp; Reliability</div>
      <ScaleButtonGrid label="Demand" value={demand} onChange={setDemand} />
      <ScaleButtonGrid label="Reliability" value={reliability} onChange={setReliability} />

      <div className="section-title">Pass Two — Enjoyment &amp; Fatigue</div>
      <ScaleButtonGrid label="Enjoyment" value={enjoyment} onChange={setEnjoyment} />
      <ScaleButtonGrid label="Fatigue" value={fatigue} onChange={setFatigue} />

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
