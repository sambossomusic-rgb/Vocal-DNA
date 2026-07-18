import { useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Song, Rating, RepertoireStatus, RatingValue, Keyword } from '../../types/domain';
import { createDefaultRating, REPERTOIRE_STATUSES, REPERTOIRE_STATUS_LABELS } from '../../types/domain';
import { ScaleButtonGrid } from '../../components/ScaleButtonGrid';

interface Props {
  songs: Song[]; // the explicitly selected songs (Constitution Priority 4)
}

const MID_SCALE: RatingValue = 3;

/**
 * Batch edits for an explicit multi-select (Priority 4). Every action here
 * only ever patches the one field it's responsible for — existing fields on
 * each song's rating are always preserved via spread, never overwritten.
 */
export function BatchActionsBar({ songs }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const allTags = useLiveQuery<Keyword[]>(() => db.keywords.toArray(), [dataVersion], []);

  const [transposeValue, setTransposeValue] = useState(0);
  const [demandValue, setDemandValue] = useState<RatingValue>(MID_SCALE);
  const [reliabilityValue, setReliabilityValue] = useState<RatingValue>(MID_SCALE);
  const [tagIdsToAdd, setTagIdsToAdd] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [busy, setBusy] = useState(false);

  async function existingOrDefaultRating(songId: string): Promise<Rating> {
    return (await db.ratings.get(songId)) ?? createDefaultRating(songId);
  }

  async function patchAllRatings(patch: (rating: Rating) => Rating): Promise<void> {
    setBusy(true);
    await db.transaction('rw', db.ratings, async () => {
      for (const song of songs) {
        const rating = await existingOrDefaultRating(song.id);
        await db.ratings.put(patch(rating));
      }
    });
    bumpDataVersion();
    setBusy(false);
  }

  async function changeStatus(status: RepertoireStatus): Promise<void> {
    if (songs.length === 0) return;
    if (!window.confirm(`Set status to "${REPERTOIRE_STATUS_LABELS[status]}" for ${songs.length} songs?`)) return;
    await patchAllRatings((r) => ({ ...r, status, ratedAt: new Date().toISOString() }));
  }

  async function applyTranspose(): Promise<void> {
    if (songs.length === 0) return;
    const sign = transposeValue > 0 ? '+' : '';
    if (!window.confirm(`Set transpose to ${sign}${transposeValue} for ${songs.length} songs?`)) return;
    await patchAllRatings((r) => ({ ...r, transpose: transposeValue, ratedAt: new Date().toISOString() }));
  }

  async function applyDemand(): Promise<void> {
    if (songs.length === 0) return;
    if (!window.confirm(`Set Demand to ${demandValue} for ${songs.length} songs?`)) return;
    await patchAllRatings((r) => ({ ...r, demand: demandValue, ratedAt: new Date().toISOString() }));
  }

  async function applyReliability(): Promise<void> {
    if (songs.length === 0) return;
    if (!window.confirm(`Set Reliability to ${reliabilityValue} for ${songs.length} songs?`)) return;
    await patchAllRatings((r) => ({ ...r, reliability: reliabilityValue, ratedAt: new Date().toISOString() }));
  }

  async function clearRatings(): Promise<void> {
    if (songs.length === 0) return;
    if (!window.confirm(`Clear all ratings for ${songs.length} songs? This cannot be undone.`)) return;
    setBusy(true);
    await db.transaction('rw', db.ratings, async () => {
      for (const song of songs) await db.ratings.delete(song.id);
    });
    bumpDataVersion();
    setBusy(false);
  }

  function toggleTagToAdd(tagId: string): void {
    setTagIdsToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function createTagToAdd(): Promise<void> {
    const name = newTagName.trim();
    if (!name) return;
    const normalized = name.toLowerCase();
    const existing = allTags.find((t) => t.name.toLowerCase() === normalized);
    const tagId = existing?.id ?? crypto.randomUUID();
    if (!existing) await db.keywords.put({ id: tagId, name });
    setTagIdsToAdd((prev) => new Set(prev).add(tagId));
    setNewTagName('');
    bumpDataVersion();
  }

  async function applyTags(): Promise<void> {
    if (songs.length === 0 || tagIdsToAdd.size === 0) return;
    if (!window.confirm(`Add ${tagIdsToAdd.size} tag(s) to ${songs.length} songs?`)) return;
    setBusy(true);
    await db.transaction('rw', db.songKeywords, async () => {
      for (const song of songs) {
        for (const tagId of tagIdsToAdd) {
          await db.songKeywords.put({ songId: song.id, keywordId: tagId });
        }
      }
    });
    bumpDataVersion();
    setTagIdsToAdd(new Set());
    setBusy(false);
  }

  return (
    <div className="card" style={{ marginTop: 12, marginBottom: 20 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Batch actions · {songs.length} selected
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>Change status</div>
      <div className="quick-assess-grid" style={{ marginBottom: 18 }}>
        {REPERTOIRE_STATUSES.map((status) => (
          <button
            key={status}
            className="quick-assess-button"
            disabled={busy}
            onClick={() => changeStatus(status)}
            style={{ minHeight: 56, flexDirection: 'row', fontSize: 14 }}
          >
            {REPERTOIRE_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <ScaleButtonGrid label="Set Demand" value={demandValue} onChange={setDemandValue} />
      <button className="button-primary" disabled={busy} onClick={applyDemand} style={{ marginBottom: 18 }}>
        Apply Demand to all
      </button>

      <ScaleButtonGrid label="Set Reliability" value={reliabilityValue} onChange={setReliabilityValue} />
      <button className="button-primary" disabled={busy} onClick={applyReliability} style={{ marginBottom: 18 }}>
        Apply Reliability to all
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
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

      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>Add tags</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {allTags
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((tag) => (
            <button
              key={tag.id}
              className={`tag-chip ${tagIdsToAdd.has(tag.id) ? 'tag-chip-assigned' : ''}`}
              onClick={() => toggleTagToAdd(tag.id)}
            >
              {tag.name}
            </button>
          ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          className="text-input"
          placeholder="New tag…"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') createTagToAdd();
          }}
          style={{ flex: 1 }}
        />
        <button className="button-secondary" onClick={createTagToAdd}>
          Add
        </button>
      </div>
      <button
        className="button-primary"
        disabled={busy || tagIdsToAdd.size === 0}
        onClick={applyTags}
        style={{ marginBottom: 18 }}
      >
        Add {tagIdsToAdd.size > 0 ? tagIdsToAdd.size : ''} tag(s) to all
      </button>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <button
          className="button-secondary"
          disabled={busy}
          onClick={clearRatings}
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          Clear ratings for all selected
        </button>
      </div>
    </div>
  );
}
