import { useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Keyword, SongKeyword } from '../../types/domain';
import { SUGGESTED_TAGS } from '../../types/domain';

interface Props {
  songId: string;
}

/**
 * Free-form tag picker for one song. Tags are never hardcoded — tapping an
 * existing tag attaches it in one tap, a curated set of common performance
 * tags is offered as one-tap create-and-attach chips (Version 3), and any new
 * name can still be typed. Backed by the `keywords`/`songKeywords` tables.
 */
export function TagEditor({ songId }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const [newTagName, setNewTagName] = useState('');

  const allTags = useLiveQuery<Keyword[]>(() => db.keywords.toArray(), [dataVersion], []);
  const songTagLinks = useLiveQuery<SongKeyword[]>(
    () => db.songKeywords.where('songId').equals(songId).toArray(),
    [songId, dataVersion],
    []
  );

  const assignedIds = new Set(songTagLinks.map((link) => link.keywordId));
  const assignedTags = allTags
    .filter((tag) => assignedIds.has(tag.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const availableTags = allTags
    .filter((tag) => !assignedIds.has(tag.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const assignedNamesLower = new Set(assignedTags.map((t) => t.name.toLowerCase()));
  const availableNamesLower = new Set(availableTags.map((t) => t.name.toLowerCase()));
  // Suggested tags that don't already exist as a chip above — one tap creates
  // and attaches them.
  const freshSuggestions = SUGGESTED_TAGS.filter(
    (name) => !assignedNamesLower.has(name.toLowerCase()) && !availableNamesLower.has(name.toLowerCase())
  );

  async function attachTag(tagId: string): Promise<void> {
    await db.songKeywords.put({ songId, keywordId: tagId });
    bumpDataVersion();
  }

  async function removeTag(tagId: string): Promise<void> {
    await db.songKeywords.delete([songId, tagId]);
    bumpDataVersion();
  }

  async function createAndAttachByName(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    const existing = allTags.find((tag) => tag.name.toLowerCase() === normalized);
    const tagId = existing?.id ?? crypto.randomUUID();
    if (!existing) await db.keywords.put({ id: tagId, name: trimmed });
    await attachTag(tagId);
  }

  return (
    <div>
      {assignedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {assignedTags.map((tag) => (
            <button
              key={tag.id}
              className="tag-chip tag-chip-assigned"
              onClick={() => removeTag(tag.id)}
            >
              {tag.name} ✕
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          className="text-input"
          placeholder="New tag…"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              createAndAttachByName(newTagName);
              setNewTagName('');
            }
          }}
          style={{ flex: 1 }}
        />
        <button
          className="button-secondary"
          onClick={() => {
            createAndAttachByName(newTagName);
            setNewTagName('');
          }}
        >
          Add
        </button>
      </div>

      {availableTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {availableTags.map((tag) => (
            <button key={tag.id} className="tag-chip" onClick={() => attachTag(tag.id)}>
              + {tag.name}
            </button>
          ))}
        </div>
      )}

      {freshSuggestions.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Suggested</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {freshSuggestions.map((name) => (
              <button
                key={name}
                className="tag-chip"
                style={{ opacity: 0.75 }}
                onClick={() => createAndAttachByName(name)}
              >
                + {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
