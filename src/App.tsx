import { useState } from 'react';
import { AssessView } from './features/assess/AssessView';
import { LibraryView } from './features/library/LibraryView';
import { StatsView } from './features/stats/StatsView';
import { VoiceProfileView } from './features/voice-profile/VoiceProfileView';
import { ImportView } from './features/import/ImportView';
import { SongDetailView } from './features/song-detail/SongDetailView';
import { useDataVersion } from './db/dataVersion';
import { EMPTY_FILTERS, type FilterState } from './features/library/FilterPanel';

type Tab = 'assess' | 'library' | 'stats' | 'voice-profile' | 'import';

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('assess');
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [pendingLibraryFilter, setPendingLibraryFilter] = useState<FilterState | null>(null);

  // Re-render on every write anywhere in the app (import, rating save, ...).
  useDataVersion();

  // Constitution Priority 4 — "every analysis should become navigation".
  // Passed to Statistics/Voice Profile so any bar, row, or quadrant can jump
  // straight to a filtered Library view.
  function navigateToLibrary(filterPatch: Partial<FilterState>, label?: string): void {
    setPendingLibraryFilter({ ...EMPTY_FILTERS, ...filterPatch, songIdsLabel: label ?? null });
    setTab('library');
  }

  if (openSongId) {
    return (
      <div className="app-shell">
        <SongDetailView songId={openSongId} onBack={() => setOpenSongId(null)} />
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
        <button
          className={`tab-button ${tab === 'import' ? 'active' : ''}`}
          onClick={() => setTab('import')}
        >
          Import
        </button>
      </nav>

      <main className="app-content">
        {tab === 'assess' && <AssessView />}
        {tab === 'library' && (
          <LibraryView
            onOpenSong={(id) => setOpenSongId(id)}
            pendingFilter={pendingLibraryFilter}
            onConsumePendingFilter={() => setPendingLibraryFilter(null)}
          />
        )}
        {tab === 'stats' && <StatsView onNavigateToLibrary={navigateToLibrary} onOpenSong={(id) => setOpenSongId(id)} />}
        {tab === 'voice-profile' && (
          <VoiceProfileView onOpenSong={(id) => setOpenSongId(id)} onNavigateToLibrary={navigateToLibrary} />
        )}
        {tab === 'import' && <ImportView onImportComplete={() => setTab('library')} />}
      </main>
    </div>
  );
}
