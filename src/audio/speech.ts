import { lang, type Lang } from '../i18n/core';
import { sound } from './sound';

/**
 * A shouted "UNO!" in a human voice (see voice.ts for the synthesised one used where the device has no voice). It uses the speech voices built into the player's own device
 * (Siri voices on iPhone and Mac, Google voices on Android and in Chrome), so nothing recorded ships with the game.
 * Every seat gets its own pitch, so the players at a table sound like different people.
 */
const WORD: Record<Lang, string> = { ru: 'Уно!', en: 'Uno!', pl: 'Uno!' };
const LOCALE: Record<Lang, string> = { ru: 'ru', en: 'en', pl: 'pl' };
/** the more natural-sounding voices go first */
const GOOD = /premium|enhanced|natural|neural|siri|google|milena|yuri|samantha|zosia|ava|allison|daniel|karen/i;
const ROBOTIC = /espeak|compact|novelty|whisper|bells|bad news|boing|bubbles|cellos|jester|organ|trinoids|zarvox|albert|fred|junior|ralph/i;

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let unlocked = false;
const lastAt = new Map<number, number>();

function pickVoice(l: Lang): SpeechSynthesisVoice | null {
  if (!synth) return null;
  const all = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith(LOCALE[l]) && !ROBOTIC.test(v.name));
  if (!all.length) return null;
  return all.find(v => GOOD.test(v.name) && v.localService) ?? all.find(v => GOOD.test(v.name)) ?? all.find(v => v.localService) ?? all[0];
}

/** iPhone speaks only after a first tap: say nothing, silently, on the first touch. */
function unlock() {
  if (unlocked || !synth) return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  // asking once starts loading the voice list (Chrome fills it a moment later)
  synth?.getVoices();
}

export const speech = {
  supported: !!synth,
  /**
   * "UNO!" from the player at `seat`. The same seat never shouts twice within a few seconds
   * (calling it and then laying the card is one shout).
   */
  uno(seat: number): 'spoken' | 'repeat' | 'none' {
    if (!synth || !sound.prefs.sfx) return 'none';
    const l = lang();
    const v = pickVoice(l);
    // no voice for this language on the device: the table's own synthesised shout instead
    if (!v) return 'none';
    const now = Date.now();
    if (now - (lastAt.get(seat) ?? 0) < 4000) return 'repeat';
    lastAt.set(seat, now);
    const u = new SpeechSynthesisUtterance(WORD[l]);
    u.voice = v;
    u.lang = v?.lang ?? LOCALE[l];
    // excited and a little fast; each seat its own pitch (lower and higher voices around the table)
    const pitches = [1.15, 0.8, 1.45, 0.95, 1.3, 0.7, 1.55, 1.05];
    u.pitch = pitches[((seat % pitches.length) + pitches.length) % pitches.length];
    u.rate = 1.12;
    u.volume = 1;
    synth.cancel();
    synth.speak(u);
    return 'spoken';
  },
};
