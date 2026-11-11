import { getRandomValues, randomInt } from 'node:crypto';
import type { Rng } from '../src/game/random';

const BATCH = 1024;

/**
 * Numbers in [0, 1) from the system's cryptographic generator, read in batches so that bots thinking ahead
 * stay fast. Players see some random numbers (the opaque ids of hidden cards); with Math.random they could
 * work out its state and from it the shuffle. With this one, what they see says nothing about the rest.
 */
export function cryptoRng(): Rng {
  const buf = new Uint32Array(BATCH * 2);
  let i = buf.length;
  return () => {
    if (i >= buf.length) {
      getRandomValues(buf);
      i = 0;
    }
    // 53 random bits, like Math.random
    const hi = buf[i++] >>> 5;
    const lo = buf[i++] >>> 6;
    return (hi * 67108864 + lo) / 9007199254740992;
  };
}

/** A random integer in [min, max). */
export const secureInt = (min: number, max: number) => randomInt(min, max);
