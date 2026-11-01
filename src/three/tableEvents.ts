import { events as pointerEvents } from '@react-three/fiber';
import type { EventManager } from '@react-three/fiber';

/**
 * The table's pointer events, aimed only by the canvas itself. Player plates, badges and bubbles are drawn over the
 * table as HTML inside it; a pointer over one of those used to be aimed at the wrong spot (its position was taken
 * relative to the plate), so a pine or a pumpkin behind a plate lit up and shook. Over such an overlay the table now
 * sees nothing at all (the pointer itself stays where it is: the camera's gentle follow must not jump).
 */
export function tableEvents(store: Parameters<typeof pointerEvents>[0]): EventManager<HTMLElement> {
  const base = pointerEvents(store);
  return {
    ...base,
    compute(event, state) {
      if (event.target !== state.gl.domElement) {
        // the pointer keeps its true place on the table (the camera follows it a little), but the ray points away
        // from the scene, so nothing under the plate is hit
        const r = state.gl.domElement.getBoundingClientRect();
        state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
        state.raycaster.ray.origin.set(0, -1e6, 0);
        state.raycaster.ray.direction.set(0, -1, 0);
        return;
      }
      base.compute?.(event, state);
    },
  };
}
