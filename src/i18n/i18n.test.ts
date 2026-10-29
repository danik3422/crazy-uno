import { describe, expect, it } from 'vitest';
import { DARE_COUNT, GROUP_DARE_COUNT, PUNISH_COUNT } from '../game/content';
import { Game } from '../game/engine';
import { DEFAULT_RULES } from '../game/content';
import { langFrom, PACKS, render, tr } from './core';
import { enLists } from './en';
import { plLists } from './pl';
import { ruLists, ruStrings } from './ru';
import { LANGS } from './types';

describe('i18n', () => {
  it('has every key in every language', () => {
    const keys = Object.keys(ruStrings).sort();
    for (const l of LANGS) expect(Object.keys(PACKS[l].s).sort()).toEqual(keys);
  });

  it('has the same number of dares, forfeits and group dares everywhere', () => {
    for (const lists of [ruLists, enLists, plLists]) {
      expect(lists.dares).toHaveLength(DARE_COUNT);
      expect(lists.punish).toHaveLength(PUNISH_COUNT);
      expect(lists.groupDares).toHaveLength(GROUP_DARE_COUNT);
    }
  });

  it('picks the language from the browser', () => {
    expect(langFrom(['uk-UA', 'en'])).toBe('ru');
    expect(langFrom(['be'])).toBe('ru');
    expect(langFrom(['pl-PL'])).toBe('pl');
    expect(langFrom(['de-DE', 'pl'])).toBe('pl');
    expect(langFrom(['de-DE'])).toBe('en');
    expect(langFrom([])).toBe('en');
  });

  it('uses the right plural forms', () => {
    expect(tr('ru', 'table.cards', { n: 1 })).toBe('1 карта');
    expect(tr('ru', 'table.cards', { n: 3 })).toBe('3 карты');
    expect(tr('ru', 'table.cards', { n: 5 })).toBe('5 карт');
    expect(tr('pl', 'table.cards', { n: 1 })).toBe('1 karta');
    expect(tr('pl', 'table.cards', { n: 22 })).toBe('22 karty');
    expect(tr('pl', 'table.cards', { n: 12 })).toBe('12 kart');
    expect(tr('en', 'table.cards', { n: 1 })).toBe('1 card');
    expect(tr('en', 'table.cards', { n: 7 })).toBe('7 cards');
  });

  it('renders the same log line in each reader’s language, nested messages included', () => {
    const line = { k: 'log.played' as const, p: { who: 'Ann', card: { k: 'cardName' as const, p: { type: 'skip', color: 'red' } } } };
    expect(render(line, 'ru')).toBe('Ann кладёт Пропуск (красный)');
    expect(render(line, 'en')).toBe('Ann plays red Skip');
    expect(render(line, 'pl')).toBe('Ann kładzie Stop (czerwony)');
  });

  it('renders every message a real game produces, in every language, with no placeholder left', () => {
    const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, startAction: true } });
    for (let i = 0; i < 400 && g.s.phase !== 'over'; i++) {
      g.botAct(true);
      for (const l of LANGS) {
        for (const m of g.s.log.slice(-3)) expect(render(m, l)).not.toMatch(/\{\w+\}|undefined|\[object/);
        for (const f of g.s.fx) if (f.text) expect(render(f.text, l)).not.toMatch(/\{\w+\}|undefined|\[object/);
      }
    }
  });
});
