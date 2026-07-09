import { useEffect, useState } from 'react';
import { api } from './api';

// Minimal data-fetching hook (no extra dependency): loads a GET endpoint and
// tracks loading/error/data, cancelling stale updates on unmount or path change.
export function useApiData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e : new Error('request_failed'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path]);

  return { data, error, loading };
}
