import * as THREE from 'three';

/**
 * Drag-and-drop of hand cards, shared between the dragged card and the drop zone on the table.
 * Lives outside React: it changes every pointer move and is read inside useFrame.
 */
export const drag = {
  id: null as number | null,
  /** past the small dead zone that still counts as a tap */
  moved: false,
  over: false,
  startX: 0,
  startY: 0,
  point: new THREE.Vector3(),
  /** a drag ends in a click event too; ignore clicks until this moment (ms) */
  suppressClickUntil: 0,
};

/** Where cards are dropped, set by the scene layout. */
export const dropZone = { x: 0, z: 0, radius: 2.4, handZ: 4 };

export const DRAG_HEIGHT = 1.3;

/** Keyboard play: the hand card picked with the arrow keys (lifted like a hovered card). */
export const keySel = { id: null as number | null };
