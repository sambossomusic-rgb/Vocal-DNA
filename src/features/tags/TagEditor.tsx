import { useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Keyword, SongKeyword } from '../../types/domain';

interface Props {
  songId: string;
}

/**
 * Free-form tag picker for one song (Constitution Feature 7). Tags are never
 * hardcoded — tapping an existing tag attaches it in one tap, or typing a
 * new name creates and attaches it. Backed by the `keywords`/`songKeywords`
 * tables reserved for exactly this in Version 1.
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

  async function attachTag(tagId: string): Promise<void> {
    await db.songKeywords.put({ songId, keywordId: tagId });
    bumpDataVersion();
  }

  async function removeTag(tagId: string): Promise<void> {
    await db.songKeywords.delete([songId, tagId]);
    bumpDataVersion();
  }

  async function createAndAttachTag(): Promise<void> {
    const name = newTagName.trim();
    if (!name) return;
    const normalized = name.toLowerCase();
    const existing = allTags.find((tag) => tag.name.toLowerCase() === normalized);
    const tagId = existing?.id ?? crypto.randomUUID();
    if (!existing) await db.keywords.put({ id: tagId, name });
    await attachTag(tagId);
    setNewTagName('');
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
            if (e.key === 'Enter') createAndAttachTag();
          }}
          style={{ flex: 1 }}
        />
        <button className="button-secondary" onClick={createAndAttachTag}>
          Add
        </button>
      </div>

      {availableTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {availableTags.map((tag) => (
            <button key={tag.id} className="tag-chip" onClick={() => attachTag(tag.id)}>
              + {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
