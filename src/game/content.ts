import type { CardType, Color, EventId, Rules, Table, ThemeId } from './types';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

export const CNAME: Record<Color, string> = { red: 'Красный', yellow: 'Жёлтый', green: 'Зелёный', blue: 'Синий' };
/** "все красные / жёлтые…" */
export const CPLURAL: Record<Color, string> = { red: 'красные', yellow: 'жёлтые', green: 'зелёные', blue: 'синие' };

export const HEX: Record<Color | 'black', string> = {
  red: '#e5413a', yellow: '#f2bf16', green: '#26a556', blue: '#2c79dc', black: '#19191d',
};

export const SPECIAL: Record<Exclude<CardType, 'num'>, { sym: string; name: string; desc: string }> = {
  skip: { sym: '⊘', name: 'Пропуск', desc: 'Следующий пропускает ход' },
  rev: { sym: '⇄', name: 'Разворот', desc: 'Игра идёт в обратную сторону' },
  draw2: { sym: '+2', name: '+2', desc: 'Следующий тянет 2. Со стопкой можно отбиться своей +2' },
  wild: { sym: '★', name: 'Цвет', desc: 'Выбираешь любой цвет' },
  wild4: { sym: '+4', name: '+4', desc: 'Выбираешь цвет, следующий тянет 4' },
  swap: { sym: '⇆', name: 'Обмен', desc: 'Меняешься всеми картами с кем захочешь' },
  gift: { sym: '🎁', name: 'Подарок', desc: 'Даришь одну свою карту любому игроку' },
  bomb: { sym: '💣', name: 'Бомба', desc: 'У следующего 10 секунд на ход, иначе +3' },
  dare: { sym: '🎭', name: 'Фант', desc: 'Следующий получает задание. Отказался — тянет 2' },
  rain: { sym: '☔', name: 'Ливень', desc: 'Все остальные тянут по карте' },
  mirror: { sym: '🪞', name: 'Зеркало', desc: 'Отражает +2/+4 обратно. Кладётся на любой штраф. Без штрафа — разворот' },
  chaos: { sym: '🌪', name: 'Хаос', desc: 'Карты всех игроков перемешиваются и раздаются поровну' },
  dump: { sym: '🧹', name: 'Уборка', desc: 'Выбираешь цвет и сбрасываешь все свои карты этого цвета' },
  // UNO Show 'Em No Mercy
  draw4: { sym: '+4', name: '+4', desc: 'Цветная +4: следующий тянет 4 и пропускает ход' },
  skipAll: { sym: '⊘', name: 'Пропуск всех', desc: 'Все пропускают ход, ты ходишь ещё раз' },
  discardAll: { sym: '🗑️', name: 'Сброс цвета', desc: 'Сбрасываешь все свои карты этого цвета' },
  wildRev4: { sym: '⇄', name: 'Разворот +4', desc: 'Игра идёт обратно, и тот, кто теперь ходит, тянет 4' },
  wild6: { sym: '+6', name: '+6', desc: 'Выбираешь цвет, следующий тянет 6' },
  wild10: { sym: '+10', name: '+10', desc: 'Выбираешь цвет, следующий тянет 10' },
  roulette: { sym: '🎡', name: 'Рулетка', desc: 'Следующий называет цвет и тянет карты, пока не попадётся этот цвет' },
};

/** Wild cards (black, any colour may be named). */
export const WILD_TYPES: CardType[] = ['wild', 'wild4', 'chaos', 'dump', 'wildRev4', 'wild6', 'wild10', 'roulette'];

/** Cards that only come in the No Mercy deck. */
export const NO_MERCY_TYPES: CardType[] = ['draw4', 'skipAll', 'discardAll', 'wildRev4', 'wild6', 'wild10', 'roulette'];

/** No Mercy: holding this many cards knocks you out. */
export const MERCY_LIMIT = 25;

export const RULES: { id: keyof Rules; name: string; desc: string; def: boolean }[] = [
  { id: 'stack', name: 'Стопка штрафов', desc: '+2 на +2, +4 на любой штраф. Кто не отбился — тянет всё.', def: true },
  { id: 'sevenZero', name: '7 и 0', desc: 'Семёрка: меняешься картами с кем хочешь. Ноль: все передают руки по кругу.', def: true },
  { id: 'crazy', name: 'Безумные карты', desc: 'Обмен, Подарок, Бомба, Ливень, Зеркало, Хаос, Уборка.', def: true },
  { id: 'dares', name: 'Фанты', desc: 'Карта 🎭 даёт следующему игроку смешное задание.', def: true },
  { id: 'uno', name: 'Кричи «UNO!»', desc: 'Остался с одной картой и не крикнул «UNO!» — любой может нажать «Поймал!», и ты тянешь 2.', def: true },
  { id: 'timer', name: 'Таймер хода', desc: 'Ограниченное время на ход. Не успел — тянешь карту и пропускаешь ход (или ходит автопилот, если он включён).', def: true },
  { id: 'challenge', name: 'Оспорить +4', desc: 'Если +4 положили, имея карту нужного цвета, и тебя это бесит — оспорь. Попался — тянет 4 сам. Ошибся — тянешь 6.', def: true },
  { id: 'drawPlay', name: 'Тяни до победного', desc: 'Тянешь из колоды, пока не попадётся карта, которой можно сходить.', def: false },
  { id: 'events', name: 'Безумные события', desc: 'В случайный момент случается что-то: метеорит +10, перекраска карт, молния, блиц…', def: true },
  { id: 'punish', name: 'Наказание проигравшему', desc: 'В конце раунда у кого больше всех карт — получает задание.', def: true },
  { id: 'noMercy', name: 'No Mercy', desc: 'Колода UNO Show ’Em No Mercy: +6, +10, рулетка. Перебить штраф можно только картой не меньше. 25 карт — выбываешь.', def: false },
];

export const DEFAULT_RULES = Object.fromEntries(RULES.map(r => [r.id, r.def])) as unknown as Rules;

export const DARES = [
  'Расскажи, как прошёл твой день, голосом диктора новостей',
  'Сделай искренний комплимент игроку справа',
  'Изобрази животное. Остальные угадывают',
  'До своего следующего хода говори только шёпотом',
  'Спой припев любой песни',
  'Сделай 10 приседаний. Карты держи в руках',
  'Произнеси тост в честь игрока слева',
  'Говори как пират до своего следующего хода. Арр!',
  'Назови 5 фруктов за 5 секунд',
  'Расскажи анекдот. Несмешной тоже засчитывается',
  'Станцуй 10 секунд без музыки',
  'Поменяйся местами с любым игроком',
  'Скажи три раза быстро: «Шла Саша по шоссе и сосала сушку»',
  'Придумай прозвище каждому игроку',
  'Объясни правила UNO так, будто тебе пять лет',
  'Покажи, как ты выглядишь в понедельник в 7 утра',
  'Расскажи о самом неловком моменте этой недели',
  'Заканчивай каждую фразу словом «капибара» до конца круга',
  'Прорекламируй свои карты, как продавец на рынке',
  'Сыграй в гляделки с игроком слева',
  'Объяви следующего игрока, как ведущий бокса',
  'Покажи свою лучшую злодейскую усмешку',
  'Говори о себе в третьем лице до следующего хода',
  'Пропой своё имя оперным голосом',
  'Нарисуй пальцем в воздухе кота. Остальные ставят оценку',
  'Расскажи, какая суперсила тебе досталась бы и почему',
  'Изобрази любого игрока за столом. Остальные угадывают',
  'Придумай рекламный слоган для своего соседа',
  'Изобрази робота-пылесоса, который застрял под диваном',
  'Сделай групповое селфи со всеми, у кого больше 5 карт',
];

export const PUNISH = [
  'Приносит всем чай, воду или что попросят',
  'Тасует и раздаёт в следующем раунде, громко комментируя',
  'Весь следующий раунд говорит в рифму',
  'Сочиняет оду победителю из четырёх строк и зачитывает с чувством',
  'Носит титул «Картофелина раунда» до следующей своей победы',
  'Исполняет победный танец в честь победителя',
  'Изображает победителя. Остальные оценивают сходство',
  'Следующий раунд обращается ко всем «ваше величество»',
  'Рассказывает, почему проиграл, как спортивный комментатор',
  'Делает 15 приседаний под счёт всей компании',
];

export const BOTNAMES = ['Бот Валера', 'Бот Зинаида', 'Бот Кекс', 'Бот Тостер', 'Бот Пельмень', 'Бот Жорик', 'Бот Галя'];

export const EVENTS: Record<EventId, { icon: string; title: string; desc: string }> = {
  meteor: { icon: '☄️', title: 'Метеорит!', desc: 'Падает на случайного игрока: +10 карт' },
  recolor: { icon: '🎨', title: 'Перекраска!', desc: 'Все карты на руках меняют цвет как попало' },
  mono: { icon: '🌈', title: 'День одного цвета', desc: 'Все цветные карты на руках становятся одного цвета' },
  carousel: { icon: '🎠', title: 'Карусель!', desc: 'Все передают свои карты следующему игроку' },
  robin: { icon: '🏹', title: 'Робин Гуд', desc: 'Лидер отдаёт 2 карты тому, у кого их больше всех' },
  upside: { icon: '🙃', title: 'Вверх тормашками', desc: 'Стол переворачивается. Привыкайте' },
  blind: { icon: '🕶️', title: 'Игра вслепую', desc: 'Целый круг ходим, не видя своих карт' },
  blitz: { icon: '⚡', title: 'Блиц!', desc: 'Целый круг: 7 секунд на ход, иначе +2' },
  lightning: { icon: '🌩️', title: 'Молния!', desc: 'Бьёт случайного игрока: пропуск хода' },
  jackpot: { icon: '🍀', title: 'Джекпот!', desc: 'Случайный счастливчик сбрасывает 3 карты' },
  group: { icon: '🎤', title: 'Общий фант', desc: 'Задание для всех сразу' },
  coin: { icon: '🪙', title: 'Монетка судьбы', desc: 'Угадаешь — сбросишь 2 карты. Нет — тянешь 2' },
  bomber: { icon: '✈️', title: 'Бомбардировщик!', desc: 'Маскот пролетает над столом и сбрасывает 3 карты на случайного игрока' },
};

export const THEMES_LIST: { id: ThemeId; name: string; desc: string }[] = [
  { id: 'classic', name: 'Классика', desc: 'Яркая арена, которая перекрашивается под цвет хода' },
  { id: 'neon', name: 'Неон', desc: 'Тёмный клуб, светящаяся сетка и неоновые фигуры' },
  { id: 'space', name: 'Космос', desc: 'Звёзды, планета с кольцами и пролетающие астероиды' },
  { id: 'halloween', name: 'Хэллоуин', desc: 'Паутина, летучие мыши и светящиеся тыквы' },
];

export const isTheme = (t: unknown): t is ThemeId => THEMES_LIST.some(x => x.id === t);

export const GROUP_DARES = [
  'Все хором поют припев любой песни, которую знают все',
  'Все 10 секунд изображают статуи. Кто пошевелился, тот и смешной',
  'Каждый по кругу называет слово на букву «К». Кто завис, тот хлопает остальным',
  'Все показывают своё лучшее удивлённое лицо. Победителя выбирают голосованием',
  'Все дают пять соседям справа и слева',
  'Все делают волну руками, как на стадионе',
  'Каждый по кругу говорит тост одним предложением',
  'Все придумывают название для вашей компании. Лучшее выбирают хлопками',
  'Все 5 секунд молча смотрят на самого серьёзного игрока',
  'Все одновременно изображают любимое животное',
];

/** How the rules are shown when setting up a game: grouped, with an icon and a one-line explanation. */
export const RULE_GROUPS: { title: string; hint: string; rules: { id: keyof Rules; icon: string; short: string }[] }[] = [
  {
    title: 'Карты',
    hint: 'что можно класть и как',
    rules: [
      { id: 'stack', icon: '📚', short: '+2 на +2, +4 на любой штраф. Кто не отбился — тянет всё' },
      { id: 'sevenZero', icon: '🔄', short: '7 — меняешься картами с кем хочешь, 0 — все передают руки по кругу' },
      { id: 'crazy', icon: '🃏', short: 'Бомба, Подарок, Ливень, Зеркало, Хаос, Уборка, Обмен' },
      { id: 'drawPlay', icon: '♾️', short: 'Тянешь, пока не попадётся карта, которой можно сходить' },
      { id: 'noMercy', icon: '💀', short: 'Колода No Mercy: +6, +10, рулетка, пропуск всех. 25 карт — выбываешь' },
    ],
  },
  {
    title: 'Для компании',
    hint: 'чтобы было шумно',
    rules: [
      { id: 'uno', icon: '📣', short: 'Не крикнул «UNO!» с последней картой — тебя могут поймать на +2' },
      { id: 'challenge', icon: '⚖️', short: 'Можно оспорить +4: блефовал — тянет 4 сам, нет — ты тянешь 6' },
      { id: 'dares', icon: '🎭', short: 'Карта «Фант» даёт следующему смешное задание' },
      { id: 'punish', icon: '😈', short: 'У кого больше всех карт в конце — получает наказание' },
    ],
  },
  {
    title: 'Темп и сюрпризы',
    hint: 'чтобы никто не скучал',
    rules: [
      { id: 'timer', icon: '⏱', short: 'Время на ход. Не успел — тянешь карту и пропускаешь ход' },
      { id: 'events', icon: '🌪', short: 'Метеорит +10, молния, бомбардировщик и ещё 10 событий' },
    ],
  },
];

/** One-click rule sets. */
export const PRESETS: { id: string; icon: string; name: string; desc: string; rules: Rules }[] = [
  {
    // the official rules of UNO: no stacking, +4 can be challenged, draw one card and play it if it fits
    id: 'classic', icon: '🎴', name: 'Классика', desc: 'Настоящие правила UNO, без сюрпризов',
    rules: { stack: false, sevenZero: false, crazy: false, dares: false, uno: true, drawPlay: false, punish: false, events: false, timer: true, challenge: true, noMercy: false },
  },
  {
    // the official rules of UNO Show 'Em No Mercy, nothing added
    id: 'nomercy', icon: '💀', name: 'No Mercy', desc: 'Оригинальные правила UNO No Mercy: +10, рулетка и 25 карт на вылет',
    rules: { stack: true, sevenZero: true, crazy: false, dares: false, uno: true, drawPlay: true, punish: false, events: false, timer: true, challenge: false, noMercy: true },
  },
  {
    id: 'party', icon: '🎉', name: 'Вечеринка', desc: 'Безумные карты, фанты и события',
    rules: { stack: true, sevenZero: true, crazy: true, dares: true, uno: true, drawPlay: false, punish: true, events: true, timer: true, challenge: true, noMercy: false },
  },
  {
    id: 'chaos', icon: '🌪', name: 'Полный хаос', desc: 'Всё включено. Вообще всё',
    rules: { stack: true, sevenZero: true, crazy: true, dares: true, uno: true, drawPlay: true, punish: true, events: true, timer: true, challenge: true, noMercy: false },
  },
];

export function presetOf(r: Rules) {
  return PRESETS.find(p => (Object.keys(p.rules) as (keyof Rules)[]).every(k => p.rules[k] === r[k])) ?? null;
}

export const DEFAULT_TABLE: Table = { teams: false, quick: false, handSize: 7, turnSec: 30, bombSec: 10, unoPenalty: 2, roundMin: 0, events: 'normal', autopilot: false };

/** The quick round overrides these numbers. */
export const QUICK = { handSize: 5, turnSec: 15, roundMin: 5 };

/** The allowed values for each number, shown as small segmented choices. */
export const TABLE_CHOICES = {
  handSize: [5, 7, 10],
  turnSec: [15, 30, 60],
  bombSec: [5, 10, 15],
  unoPenalty: [2, 4],
  roundMin: [0, 5, 10],
  events: ['rare', 'normal', 'often'] as const,
};

/** What a table actually plays with (quick round wins over the individual numbers). */
export function effectiveTable(t: Table): Table {
  return t.quick ? { ...t, ...QUICK } : t;
}

/** Keep only known keys and allowed values (anything else falls back to the default). */
export function cleanTable(raw: unknown): Table {
  const r = (raw ?? {}) as Partial<Record<keyof Table, unknown>>;
  const pick = <K extends keyof typeof TABLE_CHOICES>(k: K) =>
    ((TABLE_CHOICES[k] as readonly unknown[]).includes(r[k]) ? r[k] : DEFAULT_TABLE[k]) as Table[K];
  return {
    teams: r.teams === true,
    quick: r.quick === true,
    handSize: pick('handSize'),
    turnSec: pick('turnSec'),
    bombSec: pick('bombSec'),
    unoPenalty: pick('unoPenalty'),
    roundMin: pick('roundMin'),
    events: pick('events'),
    autopilot: r.autopilot === true,
  };
}

/** Teams need an even table of at least 4. */
export function teamsProblem(players: number): string | null {
  if (players < 4) return 'Для игры командами нужно 4 игрока или больше';
  if (players % 2) return 'Для игры командами нужно чётное число игроков';
  return null;
}

export const TEAM_NAMES = ['Красные', 'Синие'];
