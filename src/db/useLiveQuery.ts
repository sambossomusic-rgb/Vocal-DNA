import { useEffect, useState } from 'react';

/**
 * Runs an async query function once, then re-runs it whenever `deps` changes.
 * This is intentionally simple: Version 1 doesn't need Dexie's live-query
 * subscription machinery, since every write path (import, rating save) is
 * explicit and can trigger a refetch by bumping a "version" dependency.
 */
export function useLiveQuery<T>(queryFn: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    let cancelled = false;
    queryFn().then((result) => {
      if (!cancelled) setValue(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
