import { useMemo, useState } from 'react';
import { SongCard } from './SongCard';
import { FilterPanel, type FilterState } from './FilterPanel';
import { BatchActionsBar } from './BatchActionsBar';
import { useLibraryData } from './useLibraryData';

interface Props {
  // Opens a song, handing up the ordered list it was opened from so Song
  // Detail's Previous/Next and "back to this filtered view" work (Version 3).
  onOpenSong: (songId: string, contextIds: string[]) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function LibraryView({ onOpenSong, filters, onFiltersChange, search, onSearchChange }: Props): JSX.Element {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    songs,
    artists,
    folders,
    playlists,
    tags,
    artistById,
    folderById,
    ratingBySongId,
    availableKeys,
    applyFilters,
  } = useLibraryData();

  const filteredSongs = useMemo(() => applyFilters(search, filters), [applyFilters, search, filters]);
  const filteredIds = useMemo(() => filteredSongs.map((s) => s.id), [filteredSongs]);

  const selectedSongs = useMemo(
    () => filteredSongs.filter((s) => selectedIds.has(s.id)),
    [filteredSongs, selectedIds]
  );

  function toggleSongSelected(songId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }

  function exitSelectMode(): void {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  if (songs.length === 0) {
    return (
      <div className="empty-state">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>No songs yet</h2>
        <p>Open the Assess tab and use Import to load a StageTraxx4 (.st4b) file.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          className="text-input"
          placeholder="Search by title or artist…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ flex: 1, fontSize: 16 }}
        />
        {selectMode ? (
          <button className="button-secondary" onClick={exitSelectMode}>
            Cancel
          </button>
        ) : (
          <button className="button-secondary" onClick={() => setSelectMode(true)}>
            Select
          </button>
        )}
      </div>

      <FilterPanel
        artists={artists}
        folders={folders}
        playlists={playlists}
        availableKeys={availableKeys}
        tags={tags}
        value={filters}
        onChange={onFiltersChange}
      />

      {selectMode && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <button className="button-secondary" onClick={() => setSelectedIds(new Set(filteredIds))}>
            Select all shown ({filteredSongs.length})
          </button>
          {selectedIds.size > 0 && (
            <button className="button-secondary" onClick={() => setSelectedIds(new Set())}>
              Deselect all
            </button>
          )}
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{selectedIds.size} selected</span>
        </div>
      )}

      {selectMode && selectedSongs.length > 0 && <BatchActionsBar songs={selectedSongs} />}

      <div className="section-title" style={{ marginTop: 20 }}>
        {filteredSongs.length} of {songs.length} songs
      </div>

      <div className="song-grid">
        {filteredSongs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            artist={song.artistId ? artistById.get(song.artistId) : undefined}
            folder={song.folderId ? folderById.get(song.folderId) : undefined}
            rating={ratingBySongId.get(song.id)}
            selectMode={selectMode}
            selected={selectedIds.has(song.id)}
            onOpen={() => onOpenSong(song.id, filteredIds)}
            onToggleSelect={() => toggleSongSelected(song.id)}
          />
        ))}
      </div>

      {filteredSongs.length === 0 && (
        <div className="empty-state">No songs match your search and filters.</div>
      )}
    </div>
  );
}
