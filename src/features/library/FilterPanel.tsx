import type { Artist, Folder, Keyword, Playlist, RepertoireStatus } from '../../types/domain';
import { REPERTOIRE_STATUSES, REPERTOIRE_STATUS_LABELS } from '../../types/domain';

export interface FilterState {
  folderId: string | null;
  playlistId: string | null;
  artistId: string | null;
  keyNote: string | null;
  status: RepertoireStatus | null;
  tagIds: string[]; // a song must carry every selected tag (AND)
}

interface Props {
  artists: Artist[];
  folders: Folder[];
  playlists: Playlist[];
  availableKeys: string[];
  tags: Keyword[];
  value: FilterState;
  onChange: (next: FilterState) => void;
}

export function FilterPanel({
  artists,
  folders,
  playlists,
  availableKeys,
  tags,
  value,
  onChange,
}: Props): JSX.Element {
  const sortedArtists = [...artists].sort((a, b) => a.name.localeCompare(b.name));
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
  const sortedPlaylists = [...playlists].sort((a, b) => a.name.localeCompare(b.name));
  const sortedTags = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  const hasActiveFilters =
    value.folderId ||
    value.playlistId ||
    value.artistId ||
    value.keyNote ||
    value.status ||
    value.tagIds.length > 0;

  function toggleTag(tagId: string): void {
    const active = value.tagIds.includes(tagId);
    onChange({
      ...value,
      tagIds: active ? value.tagIds.filter((id) => id !== tagId) : [...value.tagIds, tagId],
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="select-input"
          value={value.folderId ?? ''}
          onChange={(e) => onChange({ ...value, folderId: e.target.value || null })}
        >
          <option value="">All folders</option>
          {sortedFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        {sortedPlaylists.length > 0 && (
          <select
            className="select-input"
            value={value.playlistId ?? ''}
            onChange={(e) => onChange({ ...value, playlistId: e.target.value || null })}
          >
            <option value="">All playlists</option>
            {sortedPlaylists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <select
          className="select-input"
          value={value.artistId ?? ''}
          onChange={(e) => onChange({ ...value, artistId: e.target.value || null })}
        >
          <option value="">All artists</option>
          {sortedArtists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          className="select-input"
          value={value.keyNote ?? ''}
          onChange={(e) => onChange({ ...value, keyNote: e.target.value || null })}
        >
          <option value="">All keys</option>
          {availableKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <select
          className="select-input"
          value={value.status ?? ''}
          onChange={(e) =>
            onChange({ ...value, status: (e.target.value as RepertoireStatus) || null })
          }
        >
          <option value="">All statuses</option>
          {REPERTOIRE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REPERTOIRE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            className="button-secondary"
            onClick={() =>
              onChange({
                folderId: null,
                playlistId: null,
                artistId: null,
                keyNote: null,
                status: null,
                tagIds: [],
              })
            }
          >
            Clear filters
          </button>
        )}
      </div>

      {sortedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {sortedTags.map((tag) => (
            <button
              key={tag.id}
              className={`tag-chip ${value.tagIds.includes(tag.id) ? 'tag-chip-assigned' : ''}`}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
