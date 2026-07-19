import { useMemo } from 'react';
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
import type { FilterState } from './FilterPanel';

/**
 * Loads every table the Library and Assess screens need, builds the lookup
 * maps once, and exposes a single `applyFilters` so both screens filter a
 * collection identically (Version 3: "the Assess page should simply assess
 * whatever is currently selected"). Centralising this is what keeps the two
 * screens from drifting apart.
 */
export function useLibraryData() {
  const dataVersion = useDataVersion();

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

  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of songs) if (s.keyNote) keys.add(s.keyNote);
    return [...keys].sort();
  }, [songs]);

  // Counts shown beside each filter option (V5 item 7 — "Country (184)").
  // Computed over the whole library so the numbers are stable as you filter.
  const counts = useMemo(() => {
    const folder = new Map<string, number>();
    const artist = new Map<string, number>();
    const key = new Map<string, number>();
    const tag = new Map<string, number>();
    const status = new Map<RepertoireStatus, number>();
    for (const s of songs) {
      if (s.folderId) folder.set(s.folderId, (folder.get(s.folderId) ?? 0) + 1);
      if (s.artistId) artist.set(s.artistId, (artist.get(s.artistId) ?? 0) + 1);
      if (s.keyNote) key.set(s.keyNote, (key.get(s.keyNote) ?? 0) + 1);
      const st: RepertoireStatus = ratingBySongId.get(s.id)?.status ?? 'unexplored';
      status.set(st, (status.get(st) ?? 0) + 1);
    }
    for (const link of songKeywords) tag.set(link.keywordId, (tag.get(link.keywordId) ?? 0) + 1);
    const playlist = new Map<string, number>();
    for (const [pid, set] of songIdsByPlaylistId) playlist.set(pid, set.size);
    return { folder, artist, key, tag, status, playlist };
  }, [songs, ratingBySongId, songKeywords, songIdsByPlaylistId]);

  const applyFilters = useMemo(() => {
    return (query: string, filters: FilterState): Song[] => {
      const q = query.trim().toLowerCase();
      const playlistSongIds = filters.playlistId ? songIdsByPlaylistId.get(filters.playlistId) : null;

      const matched = songs.filter((song) => {
        if (q) {
          const title = song.title.toLowerCase();
          const artistName = song.artistId
            ? artistById.get(song.artistId)?.name.toLowerCase() ?? ''
            : '';
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

      // Stable ordering by artist then title, so the queue / grid reads
      // predictably and Next/Previous in Song Detail matches what's on screen.
      return matched.sort((a, b) => {
        const artistA = a.artistId ? artistById.get(a.artistId)?.name ?? '' : '';
        const artistB = b.artistId ? artistById.get(b.artistId)?.name ?? '' : '';
        return artistA.localeCompare(artistB) || a.title.localeCompare(b.title);
      });
    };
  }, [songs, artistById, ratingBySongId, tagIdsBySongId, songIdsByPlaylistId]);

  return {
    songs,
    artists,
    folders,
    playlists,
    tags,
    ratings,
    artistById,
    folderById,
    ratingBySongId,
    tagIdsBySongId,
    availableKeys,
    counts,
    applyFilters,
  };
}
