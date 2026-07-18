import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Folder, Rating, SongStatus } from '../../types/domain';
import { SongCard } from './SongCard';
import { FilterPanel, type FilterState } from './FilterPanel';

interface Props {
  onOpenSong: (songId: string) => void;
}

const EMPTY_FILTERS: FilterState = {
  folderId: null,
  artistId: null,
  keyNote: null,
  status: null,
};

export function LibraryView({ onOpenSong }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const artists = useLiveQuery<Artist[]>(() => db.artists.toArray(), [dataVersion], []);
  const folders = useLiveQuery<Folder[]>(() => db.folders.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);

  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const ratingBySongId = useMemo(() => new Map(ratings.map((r) => [r.songId, r])), [ratings]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return songs.filter((song) => {
      if (q) {
        const title = song.title.toLowerCase();
        const artistName = song.artistId ? artistById.get(song.artistId)?.name.toLowerCase() ?? '' : '';
        if (!title.includes(q) && !artistName.includes(q)) return false;
      }
      if (filters.folderId && song.folderId !== filters.folderId) return false;
      if (filters.artistId && song.artistId !== filters.artistId) return false;
      if (filters.keyNote && song.keyNote !== filters.keyNote) return false;
      if (filters.status) {
        const rating = ratingBySongId.get(song.id);
        const status: SongStatus = rating?.status ?? 'new';
        if (status !== filters.status) return false;
      }
      return true;
    });
  }, [songs, query, filters, artistById, ratingBySongId]);

  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of songs) if (s.keyNote) keys.add(s.keyNote);
    return [...keys].sort();
  }, [songs]);

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
      <input
        className="text-input"
        placeholder="Search by title or artist…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 16, fontSize: 16 }}
      />

      <FilterPanel
        artists={artists}
        folders={folders}
        availableKeys={availableKeys}
        value={filters}
        onChange={setFilters}
      />

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
            onOpen={() => onOpenSong(song.id)}
          />
        ))}
      </div>

      {filteredSongs.length === 0 && (
        <div className="empty-state">No songs match your search and filters.</div>
      )}
    </div>
  );
}
