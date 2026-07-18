import { useEffect, useState } from 'react';

let version = 0;
const listeners = new Set<() => void>();

/** Call after any write to the database (import, rating save, etc.). */
export function bumpDataVersion(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

/** Subscribe a component to the current data version; re-renders on every bump. */
export function useDataVersion(): number {
  const [, setTick] = useState(version);

  useEffect(() => {
    const listener = () => setTick(version);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return version;
}
