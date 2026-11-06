# План рефакторинга: Crazy UNO

## Цель
Сделать код читаемым и разложенным по папкам, стили — по файлам с общими токенами. **Поведение и внешний вид не меняются.** Работа идёт в ветке `refactor/structure`, по коммиту на задачу, в `main` ничего не пушится без разрешения.

## Решения
- **Стили остаются обычным CSS в файле рядом с компонентом** (`Lobby.tsx` + `Lobby.css`). Перевод 40 файлов на CSS-модули потребовал бы переписать каждый `className` и почти наверняка сдвинул бы внешний вид; файл рядом — второй разрешённый вариант из задания.
- **`src/styles/`** — только общее: `tokens.css` (цвета, шрифты, радиусы, отступы, тени; брейкпоинты описаны комментарием, в `@media` переменные не работают), `global.css` (сброс, `body`), `buttons.css` (`.btn` и варианты), `utilities.css` (`.muted`, `.row`, …).
- **Динамические инлайновые стили остаются** (ширина прогресс-бара, цвет игрока, CSS-переменные анимаций). Статические (3 места) уходят в CSS.
- **Логика игры и сервера делится на модули без смены API.** `Game` остаётся одним классом снаружи; внутренние части (ход, эффекты карт, вызовы, таймеры, боты, No Mercy, сохранение) уходят в функции в отдельных файлах. Тесты движка не меняются — это и есть проверка.
- **Ничего не удаляется без вопроса.** Экспорты, которые используются только внутри своего файла, перестают экспортироваться (это не удаление). Если найдётся по-настоящему мёртвый код — список на подтверждение.
- **Страховка от визуальных изменений:** перед началом снимаются эталонные скриншоты ключевых экранов (главная со всеми вкладками, настройка, лобби, ПК 1366×768 и телефон 844×390, ru и en). После каждой задачи со стилями — попиксельное сравнение с эталоном, расхождение = исправить до коммита.

## Новая структура (итог)
```
src/
  main.tsx
  app/
    App.tsx  App.css
    hooks/       useRemoteGame.ts  useServerCheck.ts
    storage/     localSave.ts  localSetup.ts
    roomUrl.ts
  styles/        tokens.css  global.css  buttons.css  utilities.css
  debug/         debug.ts               (window.__uno / __fit / __van в одном месте)
  game/
    engine/      Game.ts  turnFlow.ts  cardEffects.ts  calls.ts (UNO, +4)  clocks.ts  bots.ts  noMercy.ts  save.ts
    avatars.ts bot.ts content.ts deck.ts events.ts random.ts reactions.ts rules.ts stats.ts teams.ts types.ts view.ts
  net/           connection.ts  protocol.ts  remoteGame.ts
  i18n/          (без изменений)
  audio/         (без изменений)
  art/           (без изменений: большие файлы — это рисунки, их длина оправдана)
  lib/           lazyFile.ts  observable.ts  storage.ts
  three/
    scene/       GameScene.tsx  CameraRig.tsx  DirectionArrows.tsx  TurnMarker.tsx  DeckHit.tsx  DropZone.tsx
                 ReadySignal.tsx  Environment.tsx  DeckStack.tsx
    layout/      arena.ts (камера, стол)  seats.ts (места соперников)  hand.ts (своя рука)  targets.ts (computeTargets)  index.ts
    cards/       Card3D.tsx  cardShape.ts  textures.ts  drag.ts  glowTexture.ts  emblems.ts
    players/     PlayerPlates.tsx  PlayerPlates.css   podium/ Podium.tsx  textures.ts
    effects/     PlayFx.tsx  Bomb.tsx  Explosion.tsx  Confetti.tsx  fxState.ts  tableEvents.ts  cardFx/  eventFx/
    mascot/      Mascot.tsx  mascotRoutes.ts
    van/         KnockoutVan.tsx  models.tsx  plan.ts
    hooks/       useAdaptiveDpr.ts  useGlRecovery.ts
    debug/       FitProbe.tsx
    themes/      (без изменений)
  ui/
    components/  по файлу на компонент + свой .css
                 RotateGate.tsx → RotateGate / PhoneTip / FullscreenButton / phoneIcons
                 SoundMenu.tsx  → GearMenu / Popover / SoundSwitches
    screens/
      home/      Home.tsx  PlayerCard.tsx  WakePanel.tsx  CodeTiles.tsx  HomeFooter.tsx  (+ .css у каждого)
      lobby/     Lobby.tsx  Invite.tsx  PlayerTile.tsx  StartBar.tsx  ConnBadge.tsx    (+ .css)
      setup/  about/  howto/  profile/   (экран + стили; store.ts профиля остаётся в ui/profile/)
    game/
      Hud.tsx → Hud / UnoButtons (UnoBadge, UnoCall, UnoCatch) + UnoCall.css рядом
      hooks/     useCountdowns  useKeyboardPlay  useLocalBots  useLogRoom  useRoundStart  useStatsRecorder
                 useTableEffects  useTableSounds
    settings/    (как есть; settings.css → shared.css с пояснением)
server/
  room/          Room.ts  members.ts  playerView.ts  roundFlow.ts
  index.ts server.ts limits.ts static.ts
```

## Задачи (подробно в tasks/todo.md)
### Фаза 0. Страховка
- [ ] 1. Ветка, отдельный коммит с новыми фразами реакций, эталонные скриншоты и скрипт сравнения
### Фаза 1. Стили
- [ ] 2. Токены и разделение base.css
- [ ] 3. Главная: собрать 11 повторов landscape-блока, футер в свой файл
- [ ] 4. Дубли в Lobby / Profile / Overlays / Hud / UnoCall / GameScreen
- [ ] 5. «Ничейные» CSS к своим компонентам, статические инлайн-стили в CSS
### Контрольная точка A — сборка, тесты, скриншоты совпадают
### Фаза 2. Интерфейс
- [ ] 6. screens/home/ — разделить Home.tsx
- [ ] 7. screens/lobby/ — разделить Lobby.tsx
- [ ] 8. Остальные экраны по папкам
- [ ] 9. Разделить RotateGate, SoundMenu, Hud
- [ ] 10. Хуки: ui/game/hooks, app/hooks, app/storage
### Контрольная точка B — + партия на одном устройстве и онлайн-комната вживую
### Фаза 3. 3D
- [ ] 11. Scene.tsx → scene/ + effects/ + players/
- [ ] 12. Остальные файлы three/ по папкам
- [ ] 13. Podium: текстуры отдельно
- [ ] 14. layout.ts → layout/
### Контрольная точка C — + стол на ПК и телефоне, раздача, бус, маскот
### Фаза 4. Логика
- [ ] 15. engine.ts → game/engine/
- [ ] 16. server/room.ts → server/room/
- [ ] 17. Лишние экспорты, отладка в одном модуле, имена
### Контрольная точка D — всё зелёное, онлайн-проверка двумя окнами
### Фаза 5
- [ ] 18. /agent-skills:review, исправления, итоговое дерево и отчёт

## Риски
| Риск | Влияние | Что делаем |
|------|---------|-----------|
| Слияние повторных `@media`-блоков меняет порядок каскада | Высокое | Сливаем только блоки без перекрёстных правил; попиксельное сравнение после каждой задачи |
| Деление `engine.ts` ломает тонкую логику ходов | Высокое | Чистый перенос без изменения кода функций; 157 тестов без правок; партии ботов в тестах |
| Деление `layout.ts` сдвигает 3D-раскладку | Среднее | Перенос без правок формул; скриншоты стола в фиксированный момент (`?debug`) |
| 3D-сцену нельзя сравнить попиксельно (анимации) | Среднее | Сравнение «на глаз» по кадрам с отладочными хуками + онлайн-проверка двумя окнами |
| Перенос файлов ломает импорты | Низкое | `tsc` ловит все; правка импортов в той же задаче |
| Линтера в проекте нет | Низкое | Проверка — `tsc --strict` + `noUnusedLocals`; добавлять ESLint — только если скажешь |

## Открытые вопросы
1. Новые фразы реакций (ещё не закоммичены): коммитим их первым отдельным коммитом в ветку рефакторинга? (предлагаю да)
2. Добавить ESLint в проект? (предлагаю нет — это новый инструмент, а не рефакторинг; `tsc` уже строгий)
3. Папку `tasks/` с этим планом держать в ветке или удалить перед слиянием? (предлагаю удалить перед слиянием)
4. Фазу 4 (деление движка и сервера) делать сейчас или отдельно позже? Это самая рискованная часть; фазы 0–3 дают основную пользу для читаемости интерфейса.
