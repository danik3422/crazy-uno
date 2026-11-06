import type { Kit } from './kit';
import { sound } from './sound';

/*
 * The knock-out van's sounds (three/van): the same at every table, built from the synth kit.
 * The engine is a continuous hum driven every frame (sound.engine); these are the one-off parts.
 */

/** The sliding side door rolls open: a rising "shhh" on its rail, a soft clunk as it stops. */
export function doorOpen() {
  sound.oneShot(VAN_SOUNDS.doorOpen);
}

/** The door slams shut: a heavy thump, a burst of air and a short metal clank. */
export function doorSlam() {
  sound.oneShot(VAN_SOUNDS.doorSlam);
}

/** Two short honks before it drives off: "beep-beep". */
export function horn() {
  sound.oneShot(VAN_SOUNDS.horn);
}

/** The brakes as it pulls up: a short squeal. */
export function brakes() {
  sound.oneShot(VAN_SOUNDS.brakes);
}

/** How each one is built (also rendered offline by the sound checks). */
export const VAN_SOUNDS: Record<'doorOpen' | 'doorSlam' | 'horn' | 'brakes', (k: Kit, t: number) => void> = {
  doorOpen: (k, t) => {
      k.noise(t, 0.32, 'bandpass', 1800, 0.22, 1.2, 3400);
      k.noise(t + 0.3, 0.08, 'lowpass', 380, 0.4);
      k.wood(t + 0.31, 220, 0.25);
  },
  doorSlam: (k, t) => {
      k.noise(t, 0.18, 'bandpass', 2200, 0.18, 1, 900);
      k.tone(t + 0.16, 92, 0.22, 0.55, 'sine', 48);
      k.noise(t + 0.16, 0.12, 'lowpass', 520, 0.5);
      k.fm(t + 0.17, 620, 0.22, 0.12, 2.76, 3, 0.12);
  },
  horn: (k, t) => {
      for (const at of [0, 0.24]) {
        // a car horn is two square waves a third apart, a little nasal
        k.synth(t + at, 392, 0.16, 0.075, { wave: 'square', cutoff: 1500, attack: 0.008, release: 0.04 });
        k.synth(t + at, 494, 0.16, 0.065, { wave: 'square', cutoff: 1500, attack: 0.008, release: 0.04 });
      }
  },
  brakes: (k, t) => {
      k.tone(t, 2600, 0.28, 0.06, 'triangle', 2300, 0.04);
      k.noise(t, 0.3, 'bandpass', 3000, 0.08, 6);
  },
};
