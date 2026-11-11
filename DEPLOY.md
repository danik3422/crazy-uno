# Как выложить «Безумное UNO» в интернет

Игре нужен **постоянно работающий Node-сервер с WebSocket**: он держит комнаты и раздаёт карты.
Поэтому обычный «статический» хостинг (GitHub Pages, Netlify, Vercel) **не подойдёт**.

Ниже четыре способа — от самого быстрого к самому надёжному. Выбери один.

| Способ | Цена | Сложность | Подходит для |
|---|---|---|---|
| A. Туннель с ноутбука (Cloudflare) | бесплатно | 5 минут | поиграть сегодня вечером |
| B. Render | бесплатно (или $7/мес) | 15 минут | постоянная ссылка для друзей |
| C. Railway | ~$5/мес | 15 минут | постоянная ссылка, без «засыпания» |
| D. Свой сервер (VPS) | от ~$4/мес | 30–60 минут | свой домен, полный контроль |

Перед любым способом проверь, что у тебя локально всё собирается:

```bash
cd ~/Desktop/uno
npm install
npm test          # должно быть: Tests 23 passed
npm run build
npm start         # открой http://localhost:8080
```

---

## A. Быстро на вечер: туннель с твоего ноутбука

Игра работает на твоём компьютере, а Cloudflare даёт на неё публичную https-ссылку.
Пока ноутбук включён и не спит — друзья могут играть.

1. Установи cloudflared (один раз):
   ```bash
   brew install cloudflared
   ```
2. Запусти игру:
   ```bash
   cd ~/Desktop/uno
   npm run build
   TRUST_PROXY=1 npm start
   ```
3. В **другом** окне терминала:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
4. В выводе появится ссылка вида `https://какие-то-слова.trycloudflare.com` — её и кидай друзьям.

Минусы: ссылка меняется при каждом запуске; ноутбук нельзя закрывать и усыплять
(в «Системных настройках → Аккумулятор» включи «Не переходить в режим сна при закрытой крышке» или просто не закрывай).

---

## Подготовка для B и C: выложить код на GitHub

Render и Railway берут код из GitHub и сами пересобирают игру при каждом обновлении.

1. Заведи аккаунт на https://github.com (если нет).
2. Создай новый **пустой** репозиторий: кнопка **New**, имя например `crazy-uno`,
   **без** README и .gitignore (они уже есть в проекте). Можно сделать его **Private**.
3. В терминале:
   ```bash
   cd ~/Desktop/uno
   git init
   git add .
   git commit -m "Безумное UNO"
   git branch -M main
   git remote add origin https://github.com/ТВОЙ_ЛОГИН/crazy-uno.git
   git push -u origin main
   ```
   Если git попросит пароль — нужен не пароль от аккаунта, а **токен**:
   GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic),
   галочка `repo`, и вставь токен вместо пароля. Проще всего — поставить GitHub Desktop или выполнить `gh auth login`.

Папки `node_modules`, `dist`, `dist-server` в GitHub не попадут (они в `.gitignore`) — так и нужно.

---

## B. Render (бесплатно, проще всего)

В проекте уже есть файл `render.yaml` — Render прочитает из него все настройки.

1. Зайди на https://render.com и войди через GitHub.
2. **New → Blueprint**.
3. Выбери репозиторий `crazy-uno` → **Connect**.
4. Render покажет сервис `crazy-uno` (план Free, переменные `TRUST_PROXY=2` и `CLIENT_IP_HEADER=cf-connecting-ip`). Нажми **Apply**.
5. Подожди 3–5 минут, пока идёт сборка (во вкладке **Logs** в конце будет `УНО-сервер: http://localhost:10000`).
6. Ссылка на игру — вверху страницы сервиса, вида `https://crazy-uno.onrender.com`. Готово.

Важно про бесплатный план:
- если 15 минут никто не заходил, сервер **засыпает**; первое открытие после этого грузится ~30–60 секунд;
- при засыпании и при каждом обновлении **текущие комнаты пропадают** (их нужно создать заново).

Чтобы сервер не засыпал — в настройках сервиса смени план на **Starter** ($7/мес).

Обновить игру: просто сделай `git push` — Render сам пересоберёт и перезапустит.

---

## C. Railway

1. Зайди на https://railway.app и войди через GitHub.
2. **New Project → Deploy from GitHub repo →** выбери `crazy-uno`.
   Railway найдёт `Dockerfile` и соберёт по нему.
3. Открой сервис → вкладка **Variables** → **New Variable**: `TRUST_PROXY` = `1`.
4. Вкладка **Settings → Networking → Generate Domain** (порт `8080`).
   Появится ссылка вида `https://crazy-uno-production.up.railway.app`.
5. Подожди окончания сборки (вкладка **Deployments**) и открой ссылку.

Railway не засыпает. Бесплатный пробный период, дальше по использованию (для такой игры обычно около $5 в месяц).
Обновление — тоже через `git push`.

---

## D. Свой сервер (VPS) со своим доменом

Подойдёт любой VPS с Ubuntu 22.04/24.04 и 1 ГБ памяти (Hetzner, Timeweb, Selectel, DigitalOcean и т.п.).

1. Подключись к серверу: `ssh root@IP_СЕРВЕРА`.
2. Поставь Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Скачай и собери игру:
   ```bash
   git clone https://github.com/ТВОЙ_ЛОГИН/crazy-uno.git
   cd crazy-uno
   docker build -t crazy-uno .
   docker run -d --name uno --restart=always -p 127.0.0.1:8080:8080 -e TRUST_PROXY=1 crazy-uno
   ```
4. Направь домен на сервер: у регистратора домена добавь **A-запись** `uno.твой-домен.ru → IP_СЕРВЕРА`.
5. Поставь Caddy (официальный репозиторий) — он сам получит https-сертификат:
   ```bash
   apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
   apt update && apt install -y caddy
   echo 'uno.твой-домен.ru {
       reverse_proxy 127.0.0.1:8080
   }' > /etc/caddy/Caddyfile
   systemctl reload caddy
   ```
6. Открой `https://uno.твой-домен.ru`.

Обновить игру:
```bash
cd crazy-uno && git pull
docker build -t crazy-uno . && docker rm -f uno
docker run -d --name uno --restart=always -p 127.0.0.1:8080:8080 -e TRUST_PROXY=1 crazy-uno
```

---

## После выкладки: проверка

1. Открой `https://ТВОЙ-АДРЕС/api/health` — должно быть `{"ok":true,...}`.
2. Открой игру на ноутбуке, создай комнату, открой ссылку-приглашение на телефоне — оба должны оказаться в одной комнате.
3. Начни раунд, закрой вкладку на телефоне — за тебя должен сесть бот; открой снова — место вернётся.
4. Отправь ссылку-приглашение себе в Telegram — должно быть превью с картинкой и текстом «… зовёт тебя в UNO».
   Если превью старое, Telegram его закэшировал: отправь ссылку боту `@WebpageBot`, он обновит.

## Важные ограничения

- **Только один экземпляр сервера.** Комнаты хранятся в памяти одного процесса. Не включай «масштабирование» на несколько копий — игроки окажутся в разных копиях и не увидят друг друга.
- **Перезапуск сервера = комнаты пропадают.** Обновляй игру, когда никто не играет.
- **`TRUST_PROXY` нужен на всех хостингах из списка.** Без него сервер видит всех игроков с одного адреса прокси, и защита от спама начнёт мешать честным игрокам. Значение — сколько прокси стоит перед сервером: Railway, VPS с Caddy и туннель — `1`; Render — `2` (Cloudflare и балансировщик Render, уже прописано в `render.yaml`). Адрес игрока берётся из `X-Forwarded-For` на столько записей справа: всё, что левее, мог подделать сам браузер. Слишком большое число снова открывает подделку, слишком маленькое — склеивает всех игроков в один адрес.
- **`CLIENT_IP_HEADER`** — заголовок, в который пограничный прокси сам пишет адрес игрока (у Cloudflare: `cf-connecting-ip`). Если он есть, берётся он. Ставь его, только если перед сервером точно стоит Cloudflare (Render, туннель): иначе этот заголовок может прислать кто угодно.
- **`PUBLIC_URL`** — адрес сайта для превью ссылок (`https://uno.твой-домен.ru`). На Render берётся сам (`RENDER_EXTERNAL_URL`); задай его, если подключил свой домен.
- Порт берётся из переменной `PORT` (по умолчанию 8080) — хостинги задают её сами.
