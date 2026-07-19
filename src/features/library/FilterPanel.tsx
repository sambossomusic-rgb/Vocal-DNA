import type { Artist, Folder, Keyword, Playlist, RepertoireStatus } from '../../types/domain';
import { REPERTOIRE_STATUSES, REPERTOIRE_STATUS_LABELS } from '../../types/domain';

export interface FilterState {
  folderId: string | null;
  playlistId: string | null;
  artistId: string | null;
  keyNote: string | null;
  status: RepertoireStatus | null;
  tagIds: string[]; // a song must carry every selected tag (AND)
  // Set when navigating in from a Statistics/Voice Profile report (Priority
  // 4) — restricts to exactly these songs. `songIdsLabel` names where the
  // list came from (e.g. "Needs work") so the Library shows why.
  songIds: string[] | null;
  songIdsLabel: string | null;
}

export const EMPTY_FILTERS: FilterState = {
  folderId: null,
  playlistId: null,
  artistId: null,
  keyNote: null,
  status: null,
  tagIds: [],
  songIds: null,
  songIdsLabel: null,
};

export interface FilterCounts {
  folder: Map<string, number>;
  artist: Map<string, number>;
  key: Map<string, number>;
  tag: Map<string, number>;
  status: Map<RepertoireStatus, number>;
  playlist: Map<string, number>;
}

interface Props {
  artists: Artist[];
  folders: Folder[];
  playlists: Playlist[];
  availableKeys: string[];
  tags: Keyword[];
  counts: FilterCounts;
  value: FilterState;
  onChange: (next: FilterState) => void;
}

function withCount(label: string, count: number | undefined): string {
  return count ? `${label} (${count})` : label;
}

export function FilterPanel({
  artists,
  folders,
  playlists,
  availableKeys,
  tags,
  counts,
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
    value.tagIds.length > 0 ||
    value.songIds !== null;

  function toggleTag(tagId: string): void {
    const active = value.tagIds.includes(tagId);
    onChange({
      ...value,
      tagIds: active ? value.tagIds.filter((id) => id !== tagId) : [...value.tagIds, tagId],
    });
  }

  return (
    <div>
      {value.songIds !== null && (
        <div
          className="card"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            padding: '10px 14px',
          }}
        >
          <span style={{ fontSize: 13 }}>
            Showing <strong>{value.songIdsLabel ?? 'selected songs'}</strong> ({value.songIds.length})
          </span>
          <button
            className="button-secondary"
            style={{ padding: '6px 12px', minHeight: 32 }}
            onClick={() => onChange({ ...value, songIds: null, songIdsLabel: null })}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="select-input"
          value={value.folderId ?? ''}
          onChange={(e) => onChange({ ...value, folderId: e.target.value || null })}
        >
          <option value="">All folders</option>
          {sortedFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {withCount(f.name, counts.folder.get(f.id))}
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
                {withCount(p.name, counts.playlist.get(p.id))}
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
              {withCount(a.name, counts.artist.get(a.id))}
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
              {withCount(k, counts.key.get(k))}
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
              {withCount(REPERTOIRE_STATUS_LABELS[s], counts.status.get(s))}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button className="button-secondary" onClick={() => onChange(EMPTY_FILTERS)}>
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
              {withCount(tag.name, counts.tag.get(tag.id))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
