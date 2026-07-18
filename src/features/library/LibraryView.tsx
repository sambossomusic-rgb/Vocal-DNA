import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type {
  Song,
  Artist,
  Folder,
  Playlist,
  PlaylistItem,
  Rating,
  RepertoireStatus,
  Keyword,
  SongKeyword,
} from '../../types/domain';
import { SongCard } from './SongCard';
import { FilterPanel, type FilterState, EMPTY_FILTERS } from './FilterPanel';
import { BatchActionsBar } from './BatchActionsBar';

interface Props {
  onOpenSong: (songId: string) => void;
  // Set by App.tsx when navigating in from a Statistics/Voice Profile
  // report (Priority 4: "every analysis should become navigation").
  pendingFilter?: FilterState | null;
  onConsumePendingFilter?: () => void;
}

export function LibraryView({ onOpenSong, pendingFilter, onConsumePendingFilter }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (pendingFilter) {
      setFilters(pendingFilter);
      onConsumePendingFilter?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFilter]);

  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const artists = useLiveQuery<Artist[]>(() => db.artists.toArray(), [dataVersion], []);
  const folders = useLiveQuery<Folder[]>(() => db.folders.toArray(), [dataVersion], []);
  const playlists = useLiveQuery<Playlist[]>(() => db.playlists.toArray(), [dataVersion], []);
  const playlistItems = useLiveQuery<PlaylistItem[]>(() => db.playlistItems.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);
  const tags = useLiveQuery<Keyword[]>(() => db.keywords.toArray(), [dataVersion], []);
  const songKeywords = useLiveQuery<SongKeyword[]>(() => db.songKeywords.toArray(), [dataVersion], []);

  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const ratingBySongId = useMemo(() => new Map(ratings.map((r) => [r.songId, r])), [ratings]);
  const tagIdsBySongId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of songKeywords) {
      const list = map.get(link.songId) ?? [];
      list.push(link.keywordId);
      map.set(link.songId, list);
    }
    return map;
  }, [songKeywords]);
  const songIdsByPlaylistId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of playlistItems) {
      const set = map.get(item.playlistId) ?? new Set<string>();
      set.add(item.songId);
      map.set(item.playlistId, set);
    }
    return map;
  }, [playlistItems]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const playlistSongIds = filters.playlistId ? songIdsByPlaylistId.get(filters.playlistId) : null;

    return songs.filter((song) => {
      if (q) {
        const title = song.title.toLowerCase();
        const artistName = song.artistId ? artistById.get(song.artistId)?.name.toLowerCase() ?? '' : '';
        if (!title.includes(q) && !artistName.includes(q)) return false;
      }
      if (filters.folderId && song.folderId !== filters.folderId) return false;
      if (playlistSongIds && !playlistSongIds.has(song.id)) return false;
      if (filters.artistId && song.artistId !== filters.artistId) return false;
      if (filters.keyNote && song.keyNote !== filters.keyNote) return false;
      if (filters.status) {
        const status: RepertoireStatus = ratingBySongId.get(song.id)?.status ?? 'unexplored';
        if (status !== filters.status) return false;
      }
      if (filters.tagIds.length > 0) {
        const songTagIds = tagIdsBySongId.get(song.id) ?? [];
        if (!filters.tagIds.every((tagId) => songTagIds.includes(tagId))) return false;
      }
      if (filters.songIds && !filters.songIds.includes(song.id)) return false;
      return true;
    });
  }, [songs, query, filters, artistById, ratingBySongId, tagIdsBySongId, songIdsByPlaylistId]);

  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of songs) if (s.keyNote) keys.add(s.keyNote);
    return [...keys].sort();
  }, [songs]);

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

  function selectAllShown(): void {
    setSelectedIds(new Set(filteredSongs.map((s) => s.id)));
  }

  function exitSelectMode(): void {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  if (songs.length === 0) {
    return (
      <div className="empty-state">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>No songs yet</h2>
        <p>Go to the Import tab and choose a StageTraxx4 (.st4b) file to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          className="text-input"
          placeholder="Search by title or artist…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
        onChange={setFilters}
      />

      {selectMode && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <button className="button-secondary" onClick={selectAllShown}>
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
            onOpen={() => onOpenSong(song.id)}
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
