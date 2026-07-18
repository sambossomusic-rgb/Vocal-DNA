import { useRef, useState } from 'react';
import { importSt4b, type ImportSummary } from '../../import/st4bImporter';
import { bumpDataVersion } from '../../db/dataVersion';

type Status =
  | { kind: 'idle' }
  | { kind: 'importing' }
  | { kind: 'done'; summary: ImportSummary }
  | { kind: 'error'; message: string };

interface Props {
  onImportComplete?: () => void;
}

export function ImportView({ onImportComplete }: Props): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setStatus({ kind: 'importing' });
    try {
      const summary = await importSt4b(file);
      setStatus({ kind: 'done', summary });
      bumpDataVersion();
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Import failed for an unknown reason.',
      });
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Import your library</h1>
      <p style={{ color: 'var(--text-dim)', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
        Choose a StageTraxx4 (.st4b) file. It is read directly from your device and never
        modified — VocalDNA builds its own database in this browser's local storage. Nothing
        is uploaded anywhere.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".st4b"
        onChange={handleFileChosen}
        style={{ display: 'none' }}
      />

      <button
        className="button-primary"
        disabled={status.kind === 'importing'}
        onClick={() => fileInputRef.current?.click()}
      >
        {status.kind === 'importing' ? 'Importing…' : 'Choose .st4b file…'}
      </button>

      {status.kind === 'done' && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 10 }}>
            Import complete
          </div>

          <div className="section-title" style={{ marginTop: 0 }}>
            Found in source file
          </div>
          <ul style={{ margin: '4px 0 12px', paddingLeft: 18, fontSize: 13, color: 'var(--text-dim)' }}>
            {Object.entries(status.summary.tablesFoundInSource).map(([table, count]) => (
              <li key={table}>
                {table}: {count}
              </li>
            ))}
          </ul>

          <div className="section-title">Merged into VocalDNA</div>
          <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 13, color: 'var(--text-dim)' }}>
            <li>New songs: {status.summary.songsInserted}</li>
            <li>Updated songs: {status.summary.songsUpdated}</li>
            <li>Artists inserted: {status.summary.artistsInserted}</li>
            <li>Folders inserted: {status.summary.foldersInserted}</li>
            <li>Playlists inserted: {status.summary.playlistsInserted}</li>
            <li>Playlist-song links inserted: {status.summary.playlistItemsInserted}</li>
            <li>Missing metadata (Key or BPM): {status.summary.missingMetadataCount}</li>
          </ul>

          {status.summary.matchedByNameFallback.length > 0 && (
            <>
              <div className="section-title">
                Potential conflicts — matched by name, not StageTraxx ID ({status.summary.matchedByNameFallback.length})
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
                These songs' StageTraxx ID changed since the last import. VocalDNA matched them to
                an existing song by artist + title instead of creating a duplicate — worth a quick
                check that this is the right song.
              </p>
              <ul style={{ margin: '4px 0 12px', paddingLeft: 18, fontSize: 13, color: 'var(--text-dim)' }}>
                {status.summary.matchedByNameFallback.map((s, i) => (
                  <li key={i}>
                    {s.title} — {s.artistName}
                  </li>
                ))}
              </ul>
            </>
          )}

          {status.summary.removedSongs.length > 0 && (
            <>
              <div className="section-title">
                Removed from this export ({status.summary.removedSongs.length})
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
                Previously imported, but not present in this file. Nothing was deleted — their
                ratings, tags, and notes are untouched.
              </p>
              <ul style={{ margin: '4px 0 12px', paddingLeft: 18, fontSize: 13, color: 'var(--text-dim)' }}>
                {status.summary.removedSongs.map((s, i) => (
                  <li key={i}>
                    {s.title} — {s.artistName}
                  </li>
                ))}
              </ul>
            </>
          )}

          {status.summary.duplicateTitleGroups.length > 0 && (
            <>
              <div className="section-title">
                Duplicate titles ({status.summary.duplicateTitleGroups.length})
              </div>
              <ul style={{ margin: '4px 0 12px', paddingLeft: 18, fontSize: 13, color: 'var(--text-dim)' }}>
                {status.summary.duplicateTitleGroups.map((g) => (
                  <li key={g.title}>
                    {g.title} ({g.count} songs)
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            className="button-secondary"
            style={{ marginTop: 16 }}
            onClick={() => onImportComplete?.()}
          >
            Go to Library
          </button>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="card" style={{ marginTop: 24, borderColor: 'var(--danger)' }}>
          <div style={{ color: 'var(--danger)', fontWeight: 600 }}>{status.message}</div>
        </div>
      )}
    </div>
  );
}
