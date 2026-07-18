import { useState } from 'react';
import { db } from '../../db/db';
import { bumpDataVersion } from '../../db/dataVersion';
import type { Song, Rating, RepertoireStatus, RatingValue } from '../../types/domain';
import { createDefaultRating, metricLabel } from '../../types/domain';
import { ScaleButtonGrid } from '../../components/ScaleButtonGrid';
import { StatusPicker } from '../../components/StatusPicker';

interface Props {
  song: Song;
  rating?: Rating;
  prevId: string | null;
  nextId: string | null;
  onNavigate: (songId: string) => void;
  onBack: () => void;
}

/**
 * The deep single-song editor. Owns all rating state so Save, Previous, and
 * Next all persist the same edits (Version 3 fast-editing workflow). Metrics
 * stay nullable — an untouched metric is left unrated rather than fabricated.
 * Keyed by songId at the call site so it re-initialises per song.
 */
export function SongEditor({ song, rating, prevId, nextId, onNavigate, onBack }: Props): JSX.Element {
  const [status, setStatus] = useState<RepertoireStatus>(rating?.status ?? 'unexplored');
  const [demand, setDemand] = useState<RatingValue | null>(rating?.demand ?? null);
  const [reliability, setReliability] = useState<RatingValue | null>(rating?.reliability ?? null);
  const [enjoyment, setEnjoyment] = useState<RatingValue | null>(rating?.enjoyment ?? null);
  const [fatigue, setFatigue] = useState<RatingValue | null>(rating?.fatigue ?? null);
  const [notes, setNotes] = useState(rating?.notes ?? '');
  const [isInstrumental, setIsInstrumental] = useState<boolean>(song.isInstrumental ?? false);

  async function persist(): Promise<void> {
    const base = (await db.ratings.get(song.id)) ?? createDefaultRating(song.id);
    const next: Rating = {
      ...base,
      status,
      demand,
      reliability,
      enjoyment,
      fatigue,
      notes,
      ratedAt: new Date().toISOString(),
    };
    await db.ratings.put(next);
    if ((song.isInstrumental ?? false) !== isInstrumental) {
      await db.songs.update(song.id, { isInstrumental, updatedAt: new Date().toISOString() });
    }
    bumpDataVersion();
  }

  async function saveAndBack(): Promise<void> {
    await persist();
    onBack();
  }

  async function saveAndGo(songId: string): Promise<void> {
    await persist();
    onNavigate(songId);
  }

  return (
    <div>
      <button
        className={`tag-chip ${isInstrumental ? 'tag-chip-assigned' : ''}`}
        style={{ marginBottom: 16 }}
        onClick={() => setIsInstrumental((v) => !v)}
      >
        {isInstrumental ? '🎸 Instrumental' : '🎤 Vocal'}
      </button>

      <div className="section-title" style={{ marginTop: 0 }}>
        Status
      </div>
      <StatusPicker value={status} onChange={setStatus} />

      <ScaleButtonGrid label={metricLabel('demand', isInstrumental)} value={demand} onChange={setDemand} />
      <ScaleButtonGrid label={metricLabel('reliability', isInstrumental)} value={reliability} onChange={setReliability} />
      <ScaleButtonGrid label={metricLabel('enjoyment', isInstrumental)} value={enjoyment} onChange={setEnjoyment} />
      <ScaleButtonGrid label={metricLabel('fatigue', isInstrumental)} value={fatigue} onChange={setFatigue} />

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

      <button className="button-primary" style={{ width: '100%', marginBottom: 12 }} onClick={saveAndBack}>
        Save & back to list
      </button>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="button-secondary"
          style={{ flex: 1 }}
          disabled={!prevId}
          onClick={() => prevId && saveAndGo(prevId)}
        >
          ◀ Previous
        </button>
        <button
          className="button-secondary"
          style={{ flex: 1 }}
          disabled={!nextId}
          onClick={() => nextId && saveAndGo(nextId)}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
