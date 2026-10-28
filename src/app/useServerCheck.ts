import { useEffect, useState } from 'react';

const HEALTH_TIMEOUT_MS = 2500;

/**
 * Is there a game server behind this page? (Not when opened as a file or a static artifact.)
 * null while checking; online play is offered only when this is true.
 */
export function useServerCheck(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!/^https?:$/.test(location.protocol)) return setOk(false);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' })
      .then(r => r.json())
      .then(j => setOk(!!j?.ok))
      .catch(() => setOk(false))
      .finally(() => clearTimeout(t));
    return () => ctrl.abort();
  }, []);
  return ok;
}
