import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scene, WebGLRenderer } from 'three';
import { DEBUG } from '../effects/fxState';

/**
 * Phones may throw away the GPU context of a page that sat in the background (iOS does this a lot).
 * When that happens the canvas goes black. We rebuild the whole canvas with a fresh renderer as soon
 * as the context is lost and the page is visible again (or the browser restores it).
 * Usage: <Canvas key={glKey} onCreated={onCreated} />
 */
export function useGlRecovery() {
  const [glKey, setGlKey] = useState(0);
  const lost = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);

  const rebuild = useCallback(() => {
    if (!lost.current) return;
    if (document.visibilityState !== 'visible') return; // wait until the player comes back
    lost.current = false;
    setGlKey(k => k + 1);
  }, []);

  const onCreated = useCallback(
    ({ gl, scene }: { gl: WebGLRenderer; scene?: Scene }) => {
      cleanup.current?.();
      if (DEBUG) Object.assign(window, { __gl: gl, __scene: scene });
      const el = gl.domElement;
      const onLost = (e: Event) => {
        // tell the browser we want the context back
        e.preventDefault();
        lost.current = true;
        // a short pause lets the browser restore it on its own; if it does not, we rebuild anyway
        setTimeout(rebuild, 300);
      };
      const onRestored = () => rebuild();
      el.addEventListener('webglcontextlost', onLost);
      el.addEventListener('webglcontextrestored', onRestored);
      cleanup.current = () => {
        el.removeEventListener('webglcontextlost', onLost);
        el.removeEventListener('webglcontextrestored', onRestored);
      };
    },
    [rebuild],
  );

  useEffect(() => {
    document.addEventListener('visibilitychange', rebuild);
    return () => {
      document.removeEventListener('visibilitychange', rebuild);
      cleanup.current?.();
    };
  }, [rebuild]);

  return { glKey, onCreated };
}
