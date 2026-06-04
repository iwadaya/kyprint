import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

// Small fetch hook with refetch.
export function useFetch(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    api(path).then(setData).catch(e => setError(e.message));
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load, loading: data === null && !error };
}
