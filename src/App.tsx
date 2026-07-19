import { useState } from 'react';
import { HomeView } from './features/home/HomeView';
import { AssessView } from './features/assess/AssessView';
import { LibraryView } from './features/library/LibraryView';
import { InsightsView, type InsightsTab } from './features/insights/InsightsView';
import { SongDetailView } from './features/song-detail/SongDetailView';
import { useDataVersion } from './db/dataVersion';
import { EMPTY_FILTERS, type FilterState } from './features/library/FilterPanel';

type Tab = 'home' | 'library' | 'insights' | 'assess';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'library', label: 'Library' },
  { key: 'insights', label: 'Insights' },
  { key: 'assess', label: 'Assess' },
];

export function App(): JSX.Element {
  // Home is the new default screen (V5 item 1) — the app opens on "What should
  // I do today?", with the database one tap deeper in Library.
  const [tab, setTab] = useState<Tab>('home');
  const [insightsTab, setInsightsTab] = useState<InsightsTab>('voice');
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

  // "Every analysis becomes navigation" — Home/Insights call this to jump
  // straight into a filtered Library view.
  function navigateToLibrary(filterPatch: Partial<FilterState>, label?: string): void {
    setLibraryFilters({ ...EMPTY_FILTERS, ...filterPatch, songIdsLabel: label ?? null });
    setLibrarySearch('');
    setTab('library');
  }

  function navigateToInsights(subTab: InsightsTab): void {
    setInsightsTab(subTab);
    setTab('insights');
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
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-button ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-content">
        {tab === 'home' && (
          <HomeView
            onOpenSong={openSong}
            onNavigateToLibrary={navigateToLibrary}
            onGoToAssess={() => setTab('assess')}
            onGoToInsights={navigateToInsights}
          />
        )}
        {tab === 'library' && (
          <LibraryView
            onOpenSong={openSong}
            filters={libraryFilters}
            onFiltersChange={setLibraryFilters}
            search={librarySearch}
            onSearchChange={setLibrarySearch}
          />
        )}
        {tab === 'insights' && (
          <InsightsView
            tab={insightsTab}
            onTabChange={setInsightsTab}
            onOpenSong={openSong}
            onNavigateToLibrary={navigateToLibrary}
          />
        )}
        {tab === 'assess' && <AssessView />}
      </main>
    </div>
  );
}
