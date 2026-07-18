import { useState } from 'react';
import { db } from '../../db/db';
import { bumpDataVersion } from '../../db/dataVersion';
import type { Song, Rating, PerformanceFrequency } from '../../types/domain';
import { createDefaultRating } from '../../types/domain';

interface Props {
  songs: Song[]; // the currently filtered/searched set shown in the Library
}

const FREQUENCY_BUTTONS: Array<{ frequency: PerformanceFrequency; label: string }> = [
  { frequency: 'regular', label: '🎤 Mark Regular' },
  { frequency: 'occasional', label: '🎵 Mark Occasional' },
  { frequency: 'learning', label: '📚 Mark Learning' },
  { frequency: 'never', label: '🚫 Mark Never' },
];

/**
 * Batch updates for whatever set of songs the Library's search + filters
 * currently show (folder, artist, tag, search results — Constitution
 * Feature 3). Playlists are reserved but not yet buildable in this version,
 * so batch-by-playlist isn't offered until that feature exists.
 */
export function BatchActionsBar({ songs }: Props): JSX.Element {
  const [transposeValue, setTransposeValue] = useState(0);
  const [notesValue, setNotesValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function existingOrDefaultRating(songId: string): Promise<Rating> {
    return (await db.ratings.get(songId)) ?? createDefaultRating(songId);
  }

  async function markAll(frequency: PerformanceFrequency): Promise<void> {
    if (songs.length === 0) return;
    if (!window.confirm(`Mark all ${songs.length} songs in view as "${frequency}"?`)) return;
    setBusy(true);
    await db.transaction('rw', db.ratings, async () => {
      for (const song of songs) {
        const rating = await existingOrDefaultRating(song.id);
        await db.ratings.put({
          ...rating,
          performanceFrequency: frequency,
          ratedAt: new Date().toISOString(),
        });
      }
    });
    bumpDataVersion();
    setBusy(false);
  }

  async function applyTranspose(): Promise<void> {
    if (songs.length === 0) return;
    const sign = transposeValue > 0 ? '+' : '';
    if (!window.confirm(`Apply transpose ${sign}${transposeValue} to all ${songs.length} songs in view?`)) return;
    setBusy(true);
    await db.transaction('rw', db.ratings, async () => {
      for (const song of songs) {
        const rating = await existingOrDefaultRating(song.id);
        await db.ratings.put({ ...rating, transpose: transposeValue, ratedAt: new Date().toISOString() });
      }
    });
    bumpDataVersion();
    setBusy(false);
  }

  async function applyNotes(): Promise<void> {
    const text = notesValue.trim();
    if (!text || songs.length === 0) return;
    if (!window.confirm(`Add this note to all ${songs.length} songs in view?`)) return;
    setBusy(true);
    await db.transaction('rw', db.ratings, async () => {
      for (const song of songs) {
        const rating = await existingOrDefaultRating(song.id);
        const notes = rating.notes ? `${rating.notes}\n${text}` : text;
        await db.ratings.put({ ...rating, notes, ratedAt: new Date().toISOString() });
      }
    });
    bumpDataVersion();
    setNotesValue('');
    setBusy(false);
  }

  return (
    <div className="card" style={{ marginTop: 12, marginBottom: 20 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Batch actions · {songs.length} songs in view
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {FREQUENCY_BUTTONS.map(({ frequency, label }) => (
          <button
            key={frequency}
            className="button-secondary"
            disabled={busy}
            onClick={() => markAll(frequency)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, color: 'var(--text-dim)' }}>Transpose</label>
        <button
          className="button-secondary"
          style={{ padding: '10px 16px' }}
          onClick={() => setTransposeValue((t) => Math.max(-12, t - 1))}
        >
          −
        </button>
        <div style={{ minWidth: 40, textAlign: 'center', fontWeight: 600 }}>
          {transposeValue > 0 ? `+${transposeValue}` : transposeValue}
        </div>
        <button
          className="button-secondary"
          style={{ padding: '10px 16px' }}
          onClick={() => setTransposeValue((t) => Math.min(12, t + 1))}
        >
          +
        </button>
        <button className="button-primary" disabled={busy} onClick={applyTranspose}>
          Apply to all
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          className="text-input"
          placeholder="Note to add to all songs in view…"
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button className="button-primary" disabled={busy || !notesValue.trim()} onClick={applyNotes}>
          Apply
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
        Applies to whatever the current search, folder, artist, and tag filters show.
        Playlist-based batches will be available once playlists are built.
      </div>
    </div>
  );
}
