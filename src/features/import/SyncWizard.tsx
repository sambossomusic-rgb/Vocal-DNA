import { useRef, useState } from 'react';
import { bumpDataVersion } from '../../db/dataVersion';
import {
  parseBackup,
  analyzeSync,
  applySync,
  DEFAULT_SYNC_OPTIONS,
  type St4bBackup,
  type SyncPlan,
  type SyncOptions,
  type SyncSummary,
} from '../../import/syncEngine';

interface Props {
  onDone?: () => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'preview'; backup: St4bBackup; plan: SyncPlan; fileName: string }
  | { kind: 'applying' }
  | { kind: 'done'; summary: SyncSummary }
  | { kind: 'error'; message: string };

const SYNC_ROWS: Array<{ key: keyof SyncOptions; label: string; note?: string }> = [
  { key: 'newSongs', label: 'New songs' },
  { key: 'metadata', label: 'Title & artist' },
  { key: 'folders', label: 'Folders' },
  { key: 'bpm', label: 'BPM' },
  { key: 'playCounts', label: 'Play counts' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'keywords', label: 'Keywords → tags' },
  { key: 'keys', label: 'Keys', note: 'Overwrites keys you changed inside VocalDNA' },
];

const PROTECTED = ['Ratings', 'Status', 'Notes', 'Your tags', 'Assessment history'];

export function SyncWizard({ onDone }: Props): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [options, setOptions] = useState<SyncOptions>(DEFAULT_SYNC_OPTIONS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState({ kind: 'analyzing' });
    try {
      const backup = await parseBackup(file);
      const plan = await analyzeSync(backup);
      setState({ kind: 'preview', backup, plan, fileName: file.name });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Could not read this file.' });
    }
  }

  async function runSync(backup: St4bBackup, fileName: string): Promise<void> {
    setState({ kind: 'applying' });
    try {
      const summary = await applySync(backup, options, { name: fileName });
      bumpDataVersion();
      setState({ kind: 'done', summary });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Sync failed.' });
    }
  }

  function toggle(key: keyof SyncOptions): void {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sync from StageTraxx</h1>
      <p style={{ color: 'var(--text-dim)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Choose a StageTraxx4 (.st4b) file. VocalDNA previews every change before anything is written,
        updates only the metadata you choose, and never touches your assessments.
      </p>

      <input ref={fileInputRef} type="file" accept=".st4b" onChange={handleFileChosen} style={{ display: 'none' }} />

      {(state.kind === 'idle' || state.kind === 'error') && (
        <button className="button-primary" onClick={() => fileInputRef.current?.click()}>
          Choose .st4b file…
        </button>
      )}
      {(state.kind === 'analyzing' || state.kind === 'applying') && (
        <button className="button-primary" disabled>
          {state.kind === 'analyzing' ? 'Analysing…' : 'Syncing…'}
        </button>
      )}

      {state.kind === 'error' && (
        <div className="card" style={{ marginTop: 20, borderColor: 'var(--danger)' }}>
          <div style={{ color: 'var(--danger)', fontWeight: 600 }}>{state.message}</div>
        </div>
      )}

      {state.kind === 'preview' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            Preview — {state.fileName}
          </div>
          <ul style={{ margin: '4px 0 14px', paddingLeft: 18, fontSize: 13, color: 'var(--text-dim)' }}>
            <li>{state.plan.totalSourceSongs} songs in file</li>
            <li>{state.plan.newSongs.length} new songs</li>
            <li>
              Would update: {state.plan.updates.title} titles, {state.plan.updates.artist} artists,{' '}
              {state.plan.updates.folder} folders, {state.plan.updates.key} keys, {state.plan.updates.bpm} BPM,{' '}
              {state.plan.updates.playCount} play counts
            </li>
            <li>
              {state.plan.newFolders} new folders · {state.plan.newPlaylists} new playlists ·{' '}
              {state.plan.newKeywords} new keywords
            </li>
            {state.plan.matchedByName > 0 && (
              <li>{state.plan.matchedByName} matched by name (StageTraxx ID changed)</li>
            )}
            {state.plan.removedSongs.length > 0 && (
              <li>{state.plan.removedSongs.length} in VocalDNA but not in this file (kept, never deleted)</li>
            )}
          </ul>

          <div className="section-title">Apply which changes?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {SYNC_ROWS.map((row) => (
              <button
                key={row.key}
                className="clickable-row"
                style={{ justifyContent: 'space-between', padding: '8px 0' }}
                onClick={() => toggle(row.key)}
              >
                <span style={{ fontSize: 14 }}>
                  {options[row.key] ? '☑' : '☐'} {row.label}
                  {row.note && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--warning)' }}>{row.note}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
            Always protected (never changed by a sync): {PROTECTED.join(' · ')}.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="button-secondary" onClick={() => setState({ kind: 'idle' })}>
              Cancel
            </button>
            <button
              className="button-primary"
              style={{ flex: 1 }}
              onClick={() => runSync(state.backup, state.fileName)}
            >
              Apply sync
            </button>
          </div>
        </div>
      )}

      {state.kind === 'done' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 10 }}>Sync complete</div>
          <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 13, color: 'var(--text-dim)' }}>
            <li>New songs: {state.summary.songsInserted}</li>
            <li>Updated songs: {state.summary.songsUpdated}</li>
            <li>New folders: {state.summary.foldersInserted}</li>
            <li>New playlists: {state.summary.playlistsInserted}</li>
            <li>New playlist links: {state.summary.playlistLinksInserted}</li>
            <li>New keywords: {state.summary.keywordsInserted}</li>
            <li>New keyword links: {state.summary.songKeywordLinksInserted}</li>
          </ul>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="button-secondary" onClick={() => setState({ kind: 'idle' })}>
              Sync another file
            </button>
            <button className="button-primary" onClick={() => onDone?.()}>
              Start assessing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
