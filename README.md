# Brooklyn Watch

Telegram-канал [Brooklyn жесть](https://t.me/brooklyn_zhest_news) — лента инцидентов в Бруклине на русском языке. Полностью автоматизированная: парсеры собирают данные из публичных источников, LLM нормализует и переводит, веб-админка позволяет модерировать перед публикацией.

**Стек:** Next.js 14 · Supabase · Groq (Llama 3.3 70B) · OpenStreetMap Nominatim · Telegram Bot API
**Хостинг:** Vercel (бесплатно) + cron-job.org (бесплатно)
**Архитектура:** multi-tenant — один движок крутит сколько угодно каналов

---

## Быстрый старт

### 1. База данных Supabase

В Supabase Dashboard → SQL Editor выполни по очереди:

1. `supabase/migrations/001_initial_schema.sql` — создаёт таблицы
2. `supabase/migrations/002_seed.sql` — заполняет районами Бруклина и источниками

Проверь в Table Editor что появились таблицы `channels`, `sources`, `neighborhoods`, `incidents`, `raw_incidents`, `publish_log`, `filters`, `logs`.

### 2. Получи Groq API key (бесплатно)

Зарегистрируйся на [console.groq.com](https://console.groq.com) → API Keys → Create. Бесплатный тариф даёт ~14400 запросов/день на Llama 3.3 70B — больше чем нужно для MVP.

### 3. Настрой бота в Telegram

- Бот уже создан, токен в `.env.example`
- Добавь бота администратором в **публичный канал** `@brooklyn_zhest_news` с правом постить сообщения
- Создай **приватный тестовый канал**, добавь бота админом
- Получи числовой `chat_id` тестового канала: добавь в него [@username_to_id_bot](https://t.me/username_to_id_bot) или [@RawDataBot](https://t.me/RawDataBot), пересылка из канала покажет id вида `-100xxxxxxxxxx`

### 4. Локальный запуск

```bash
git clone https://github.com/Alexander-webov/brooklyn-watch.git
cd brooklyn-watch
cp .env.example .env
# отредактируй .env: добавь Supabase URL/keys, GROQ_API_KEY, ADMIN_PASSWORD, CRON_SECRET, SESSION_SECRET
npm install
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000) → введи пароль из `ADMIN_PASSWORD`.

### 5. Деплой на Vercel

1. Запушь в GitHub: `git push origin main`
2. На [vercel.com](https://vercel.com) → New Project → Import репозиторий → Deploy
3. В Settings → Environment Variables добавь все переменные из `.env` (кроме комментариев)
4. Передеплой

### 6. Cron-задачи (cron-job.org — бесплатно)

Зарегистрируйся на [cron-job.org](https://cron-job.org), создай 3 задачи:

| Title | URL | Schedule |
|---|---|---|
| `parse` | `https://your-app.vercel.app/api/cron/parse?secret=YOUR_CRON_SECRET` | каждые 10 минут |
| `process` | `https://your-app.vercel.app/api/cron/process?secret=YOUR_CRON_SECRET` | каждые 5 минут |
| `publish` | `https://your-app.vercel.app/api/cron/publish?secret=YOUR_CRON_SECRET` | каждые 2 минуты |

Замени `YOUR_CRON_SECRET` на значение из `.env`.

---

## Как пользоваться

После старта:

1. **Канал в тест-режиме по умолчанию.** Открой `/channels`, проверь что `test_mode = true` и заполнен `telegram_test_chat_id`. Все посты пойдут в тест.
2. **Подожди 15-30 минут** — парсеры спарсят первые источники, процессор их обработает.
3. **Открой `/queue`** — увидишь обработанные инциденты в статусе `pending` с превью поста.
4. **Одобри один-два** или нажми «Опубликовать сейчас» — пост уйдёт в тестовый канал.
5. **Когда уверен в качестве** — на `/channels` сними галку с `test_mode`. Посты пойдут в боевой `@brooklyn_zhest_news`.

### Режимы публикации

- **Manual** — ничего не публикуется без твоего одобрения. Безопасно для старта.
- **Hybrid** — высокий score (≥70) уходит в публикацию автоматически, остальное в очередь.
- **Auto** — всё со score ≥ `min_score` публикуется само. Включай только когда проверишь качество.

---

## Архитектура

```
[Источники]               [Cron parse каждые 10 мин]
  NYPD News RSS    ──┐
  Reddit r/Brooklyn ─┼──> raw_incidents (pending)
  NotifyNYC RSS    ──┘         │
                                │  [Cron process каждые 5 мин]
                                ▼
                       LLM (Groq Llama 3.3 70B)
                       перевод + классификация + score
                                │
                                ▼
                       Geocoder (Nominatim)
                       address → lat/lng → neighborhood
                                │
                                ▼
                       Dedup (radius+window+text)
                                │
                                ▼
                       incidents (pending/approved)
                                │
                                │  [Cron publish каждые 2 мин]
                                ▼
                       Telegram Bot API
                       └─> @brooklyn_zhest_news
```

### Структура проекта

```
app/
├── (admin)/          # авторизованная зона: дашборд, очередь, источники...
├── (public)/login/   # страница входа
├── api/              # REST API
│   ├── auth/         # вход/выход
│   ├── channels/     # CRUD каналов
│   ├── cron/         # три cron-эндпоинта (parse/process/publish)
│   ├── incidents/    # модерация
│   ├── neighborhoods/
│   ├── sources/
│   ├── publish/      # ручная публикация
│   └── stats/        # для дашборда
├── globals.css
└── layout.js

components/
├── Sidebar.jsx
├── PageHeader.jsx
└── IncidentCard.jsx  # главный модерационный виджет

lib/
├── supabase-admin.js # клиент с service_role
├── auth.js           # cookie-сессии (HMAC)
├── groq.js           # LLM-обработка
├── geocoder.js       # Nominatim + neighborhood matcher
├── telegram.js       # Bot API + рендер поста
├── dedup.js          # склейка дубликатов
├── logger.js         # запись в logs
└── cron-auth.js      # верификация CRON_SECRET

parsers/
├── index.js          # диспатчер по типу
├── rss.js            # NYPD News, NotifyNYC, Patch
└── reddit.js         # subreddit JSON

supabase/migrations/
├── 001_initial_schema.sql
└── 002_seed.sql      # 24 района Бруклина + источники
```

---

## Multi-tenant: добавление второго канала

Архитектура уже multi-tenant. Чтобы запустить второй канал:

1. На странице `/channels` нажми «новый канал» (TODO: реализовать кнопку или вставить SQL-INSERT в `channels` напрямую)
2. На `/sources` добавь источники для нового канала
3. На `/neighborhoods` — свои районы и хэштеги
4. Всё. Тот же код, те же crons обслуживают оба.

---

## Источники: что включено и почему

| Источник | Тип | Стоимость | Качество | Real-time |
|---|---|---|---|---|
| NYPD News RSS | rss | $0 | высокое (официальное) | задержка часы |
| r/Brooklyn | reddit | $0 | среднее (надо фильтровать) | минуты |
| r/nyc (Brooklyn keyword) | reddit | $0 | среднее | минуты |
| NotifyNYC | rss | $0 | высокое (городские уведомления) | минуты |
| Patch (Brooklyn) | rss | $0 | среднее (можно отключить) | часы |

**На будущее:**
- `@NYScanner` через nitter — самый ценный, добавится отдельно когда стабилизируешь nitter-зеркала
- Polizei-сканеры через Whisper — реально, но требует Railway worker (не helpless Vercel)
- X API basic ($100/мес) — для прямого доступа к Twitter

---

## Стоимость

| Сервис | Тариф | $/мес |
|---|---|---|
| Vercel Hobby | 100GB-hours | **$0** |
| Supabase Free | 500MB DB, 5GB transfer | **$0** |
| Groq Free | 14k req/day Llama 70B | **$0** |
| cron-job.org | unlimited cron | **$0** |
| Nominatim | 1 req/sec public | **$0** |
| Telegram Bot API | unlimited | **$0** |
| **Итого** | | **$0/мес** |

Когда упрёшься в лимиты:
- Supabase Pro $25/мес (8GB DB) — наступит после ~50k опубликованных инцидентов
- Groq Dev Tier $0.50/M токенов — когда трафика > 14k раз/день

---

## Безопасность

- Все API-роуты под `/api/` (кроме `/api/cron/*` и `/api/auth`) защищены cookie-сессией.
- `/api/cron/*` защищены `CRON_SECRET` — без секрета 401.
- `service_role` Supabase ключ используется ТОЛЬКО на сервере — никогда не возвращается в клиент.
- RLS включён на все таблицы; публичного доступа через anon key нет.
- Пароль админки сравнивается constant-time.

**Если service_role ключ утёк:** Supabase Dashboard → Settings → API → Reset → обнови переменную в Vercel.

---

## Известные ограничения

- Nominatim лимит 1 req/sec — при пиковой нагрузке геокодинг становится бутылочным горлом. Решение на будущее: локальный кэш или платный геокодер.
- Vercel function timeout 60 секунд (Hobby 10) — если процессор не успевает за один вызов, обработает оставшихся через 5 минут на следующем cron.
- Reddit JSON endpoint иногда возвращает 429 — фолбэка нет, источник просто пропускается до следующего раза.

---

## Лицензия

MIT — пользуйся, форкай, продавай. Только не выкладывай `.env` 😉
