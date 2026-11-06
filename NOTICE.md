# Notice

**Crazy UNO** (Безумное UNO) — a free, non-commercial 3D card game for the browser, made by Danylo Syloats.

- Project page: <https://danylodev.com/projects/crazy-uno/>
- Source code: <https://github.com/danik3422/crazy-uno>
- Author: <https://danylodev.com/>

This file explains what the [MIT License](LICENSE) covers, what it does not, and which third-party material the game uses.

## 1. What the MIT License covers

The MIT License applies to everything in this repository that the author created:

- the source code (client, game engine, bots, server, build and test scripts);
- the artwork drawn in code: cards, card icons, table themes, avatars, the mascot, the knock-out van and the other 3D models;
- the sounds and music, which are synthesised in code (`src/audio`); no recordings are used;
- the texts and translations of the interface;
- the splash screens and icons in `public/`.

You may use, copy, change and share all of it, also commercially, as long as the copyright notice and the license text stay with it. It comes **as is, without any warranty**.

## 2. What the MIT License does not cover: the UNO trademark

**UNO® is a registered trademark of Mattel, Inc.** All rights to it belong to its owner.

- Crazy UNO is an independent fan project made for entertainment and learning. It is **not affiliated with, endorsed, sponsored or approved by Mattel, Inc.** or its licensees (including Ubisoft).
- The word "UNO" is used only to say which game's rules this game follows (nominative use). No Mattel logos, card designs, artwork, sounds or other Mattel material are used: everything in the game was made from scratch for this project.
- The game is free: no ads, no purchases, no subscriptions, no donations. The project earns no money.
- **The MIT License grants rights to the author's own work only. It grants no right of any kind to the UNO name, logo or other Mattel trademarks.** Whoever uses or publishes this code or a fork of it is responsible for how they use the trademark. In particular:
  - do not present a fork as an official UNO product or as connected with Mattel;
  - keep this notice (or an equivalent one) with any copy you publish;
  - if you plan to use the game commercially, rename it and remove the word "UNO" from its name and texts.

## 3. Third-party software and material

The game is built on open-source libraries. They are installed through npm and are not part of this repository; each keeps its own license.

| Library | Used for | License |
| --- | --- | --- |
| [React](https://react.dev/), React DOM | the interface | MIT |
| [three.js](https://threejs.org/) | 3D rendering | MIT |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber), [@react-three/drei](https://github.com/pmndrs/drei) | 3D scene in React | MIT |
| [ws](https://github.com/websockets/ws) | the multiplayer server | MIT |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | QR codes of room invites | MIT |

Development tools (Vite, TypeScript, Vitest, ESLint, tsx, esbuild and others) are listed in `package.json` and are under their own open-source licenses.

**Fonts.** [Unbounded](https://fonts.google.com/specimen/Unbounded) and [Rubik](https://fonts.google.com/specimen/Rubik) are loaded from Google Fonts at run time and are not stored in this repository. Both are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/).

## 4. Privacy

The player's name, avatar, settings, statistics and saved game are kept only on their device, in the browser's storage. In an online game the name and the moves are sent to the game server only for the duration of the game and are not stored after the room closes. There is no analytics, no tracking and no advertising.

## 5. Rights holders

If you hold rights and believe that something in this project infringes them, please write to the author through <https://danylodev.com/projects/crazy-uno/> or <https://danylodev.com/>, or open an issue at <https://github.com/danik3422/crazy-uno/issues>. The material in question will be changed or removed promptly.
