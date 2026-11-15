import { useSyncExternalStore } from 'react';
import { readJson, STORAGE_KEYS, writeJson } from '../lib/storage';

/*
 * Looks for the two characters that visit the table: the mascot that flies over it and the knock-out van.
 * Each player picks their own on this device; online every screen shows its own player's choice
 * (nothing travels over the network), so a skin never changes the game.
 * No three.js here: the menus read this without the 3D engine.
 */

export const MASCOT_SKINS = ['barrel', 'goose', 'tractor', 'dog', 'blimp'] as const;
export const VAN_SKINS = ['olive', 'marshrutka', 'bavovna', 'ship', 'eggs'] as const;

export type MascotSkin = (typeof MASCOT_SKINS)[number];
export type VanSkin = (typeof VAN_SKINS)[number];

export interface Skins {
  mascot: MascotSkin;
  van: VanSkin;
}

const DEFAULT: Skins = { mascot: 'barrel', van: 'olive' };

function load(): Skins {
  const saved = readJson<Partial<Skins>>(STORAGE_KEYS.skins);
  return {
    mascot: MASCOT_SKINS.includes(saved?.mascot as MascotSkin) ? (saved!.mascot as MascotSkin) : DEFAULT.mascot,
    van: VAN_SKINS.includes(saved?.van as VanSkin) ? (saved!.van as VanSkin) : DEFAULT.van,
  };
}

let current: Skins = load();
const listeners = new Set<() => void>();

export const skins = {
  get: () => current,
  set(next: Partial<Skins>) {
    current = { ...current, ...next };
    writeJson(STORAGE_KEYS.skins, current);
    listeners.forEach(f => f());
  },
  subscribe(f: () => void) {
    listeners.add(f);
    return () => { listeners.delete(f); };
  },
};

/** The chosen skins; re-renders when they change (also inside the 3D scene, so a pick shows at once). */
export function useSkins() {
  return useSyncExternalStore(skins.subscribe, skins.get, skins.get);
}
