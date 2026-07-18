import type { Artist, Folder, SongStatus } from '../../types/domain';
import { SONG_STATUSES } from '../../types/domain';

export interface FilterState {
  folderId: string | null;
  artistId: string | null;
  keyNote: string | null;
  status: SongStatus | null;
}

interface Props {
  artists: Artist[];
  folders: Folder[];
  availableKeys: string[];
  value: FilterState;
  onChange: (next: FilterState) => void;
}

export function FilterPanel({ artists, folders, availableKeys, value, onChange }: Props): JSX.Element {
  const sortedArtists = [...artists].sort((a, b) => a.name.localeCompare(b.name));
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

  const hasActiveFilters = value.folderId || value.artistId || value.keyNote || value.status;

  return (
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
          onChange({ ...value, status: (e.target.value as SongStatus) || null })
        }
      >
        <option value="">All statuses</option>
        {SONG_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace('-', ' ')}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          className="button-secondary"
          onClick={() => onChange({ folderId: null, artistId: null, keyNote: null, status: null })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
