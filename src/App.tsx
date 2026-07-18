import { useState } from 'react';
import { AssessView } from './features/assess/AssessView';
import { LibraryView } from './features/library/LibraryView';
import { StatsView } from './features/stats/StatsView';
import { VoiceProfileView } from './features/voice-profile/VoiceProfileView';
import { SongDetailView } from './features/song-detail/SongDetailView';
import { useDataVersion } from './db/dataVersion';
import { EMPTY_FILTERS, type FilterState } from './features/library/FilterPanel';

type Tab = 'assess' | 'library' | 'stats' | 'voice-profile';

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('assess');
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  // The ordered list a song was opened from, so Song Detail's Previous/Next
  // walks it and Back returns to that same filtered view (Version 3).
  const [songContextIds, setSongContextIds] = useState<string[]>([]);

  // Library filter + search live here (not inside LibraryView) so opening a
  // song — which unmounts LibraryView — doesn't lose the filtered view the
  // user was browsing. Back from a song returns to exactly that view.
  const [libraryFilters, setLibraryFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [librarySearch, setLibrarySearch] = useState('');

  // Re-render on every write anywhere in the app (import, rating save, ...).
  useDataVersion();

  function openSong(songId: string, contextIds: string[]): void {
    setSongContextIds(contextIds);
    setOpenSongId(songId);
  }

  // "Every analysis becomes navigation" — Statistics/Voice Profile call this
  // to jump straight into a filtered Library view.
  function navigateToLibrary(filterPatch: Partial<FilterState>, label?: string): void {
    setLibraryFilters({ ...EMPTY_FILTERS, ...filterPatch, songIdsLabel: label ?? null });
    setLibrarySearch('');
    setTab('library');
  }

  if (openSongId) {
    return (
      <div className="app-shell">
        <SongDetailView
          songId={openSongId}
          contextIds={songContextIds}
          onNavigate={(id) => setOpenSongId(id)}
          onBack={() => setOpenSongId(null)}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="tab-bar">
        <button
          className={`tab-button ${tab === 'assess' ? 'active' : ''}`}
          onClick={() => setTab('assess')}
        >
          Assess
        </button>
        <button
          className={`tab-button ${tab === 'library' ? 'active' : ''}`}
          onClick={() => setTab('library')}
        >
          Library
        </button>
        <button
          className={`tab-button ${tab === 'stats' ? 'active' : ''}`}
          onClick={() => setTab('stats')}
        >
          Statistics
        </button>
        <button
          className={`tab-button ${tab === 'voice-profile' ? 'active' : ''}`}
          onClick={() => setTab('voice-profile')}
        >
          Voice Profile
        </button>
      </nav>

      <main className="app-content">
        {tab === 'assess' && <AssessView />}
        {tab === 'library' && (
          <LibraryView
            onOpenSong={openSong}
            filters={libraryFilters}
            onFiltersChange={setLibraryFilters}
            search={librarySearch}
            onSearchChange={setLibrarySearch}
          />
        )}
        {tab === 'stats' && <StatsView onNavigateToLibrary={navigateToLibrary} onOpenSong={openSong} />}
        {tab === 'voice-profile' && (
          <VoiceProfileView onOpenSong={openSong} onNavigateToLibrary={navigateToLibrary} />
        )}
      </main>
    </div>
  );
}
