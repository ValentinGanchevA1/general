<!-- C:\Users\vganc\g88\TECHNICAL_PLAN.md -->

# G88 — Технически план (подобрен)

> **Какво е този документ.** Осъвременен технически план, който замества легаси „технически план“ (`uploads/технически план.txt` + `app MVP v1.html`). Легаси документът описва **визията** (v1→v5: hyperlocal ядро → marketplace → live/matching → insights → монетизация); този документ я **стиковка с реално построеното** в монорепото `g88/` и дава план напред.
>
> **Не е нов източник на истина.** Авторитетът остава: `ARCHITECTURE.md` → `STATUS.md` → `SPECIFICATION.md` → `ROADMAP.md`. Този план агрегира тях + легаси визията в едно четимо място. При конфликт печелят посочените документи.
>
> **Последна редакция:** 2026-06-10.

---

## 0. TL;DR — какво се промени спрямо легаси плана

- **Легаси v1 (MVP) е надхвърлен.** Картата, presence, чатът, нотификациите са **shipped и верифицирани** (P1). Освен това backend-ът вече държи цял P3/P4 слой (геймификация, подаръци, верификация, абонаменти), който легаси планът поставяше чак във v3–v5.
- **Стекът е по-зрял от легаси предположенията.** Не Expo, а **React Native CLI 0.83 + React 19**; не „Express или NestJS“, а **NestJS 11**; не „PostGIS по-късно“, а **PostGIS + H3 от ден 1**; presence не е „dummy точки“, а **Redis ZSET-и** с реален delta fan-out.
- **Приватността е твърд инвариант, какъвто легаси планът няма.** Точни GPS координати никога не влизат в БД — fuzzing до H3 r10 центроид (~120 m) при запис.
- **Главната останала работа не е „да построим функции“, а „да изведем (surface) вече построеното в mobile“** + pre-launch hardening (TestFlight).
- **Едно реконсилиращо предупреждение:** `STATUS.md` (live) описва текущата работа като „P5 feature build-out“, докато `ROADMAP.md` фиксира гейтовете като „P2 active“. Това е известно несъответствие в номерацията — виж §7.

---

## 1. Карта: легаси визия → G88 реалност

Легаси версиите (v1–v5) се препокриват с фазите на проекта (P1–P4+), но **не 1:1**. Backend изпреварва mobile.

| Легаси | Идея | G88 фаза | Backend | Mobile (surface) | Статус |
|--------|------|----------|---------|------------------|--------|
| **v1** | Auth, профил, локация, карта, area-постове, 1:1 чат, push | **P1** | ✅ | ✅ | **Shipped & verified.** Едно отклонение: „area-based постове“ са реализирани като `alerts` + `feed` (Pulse), не като отделен `posts` модул. |
| **v2** | Marketplace, listings, базови плащания (Stripe) | **P4** | ⚠️ частично | ❌ | Stripe е **subscriptions** (test mode), не marketplace. Trades/listings backend съществува, но Connect/escrow е **explicitly cut** до P4. |
| **v3** | Live streaming + matching/dating | **P3 / P4+** | ⚠️ matching-сигнали частично | ❌ | Геймификация/challenges/achievements backend е **готов**, не изведен. Live streaming е **horizon (P4+)**, не започнат. Dating алгоритъм — не. |
| **v4** | Community insights, recommendation engine | **P4+** | ❌ | ❌ | `feed`/`trending` дават семена за insights; пълен analytics слой не е построен. |
| **v5+** | Монетизация, бизнес акаунти, екосистема | **P4+** | ⚠️ subscriptions wired | partial | Tier-ове през Stripe webhook ✅ (test). Verified badge ✅. Бизнес акаунти/промо — не. |

**Извод:** легаси „roadmap за 14 дни до MVP“ е историческа реликва. Реалният фронт сега е **P2 hardening + извеждане на P3 backend в mobile**.

---

## 2. Актуален технически стек (заменя легаси „Архитектура“ §2)

Легаси планът предлагаше Expo/Zustand/react-query/Express-или-NestJS. Реалността:

### 2.1 Mobile (`apps/mobile/`)
- **React Native 0.83 (CLI, New Architecture) · React 19 · TypeScript 5.5.**
- **State:** Redux Toolkit 2 (5 slice-а: `auth · profile · chat · pulse · discovery`). Без `redux-persist` — само токени в `AsyncStorage`.
- **Networking:** единичен Axios инстанс (`src/api/client.ts`), single-flight refresh на 401.
- **Realtime:** module-singleton Socket.IO клиент (`src/realtime/useSocket.ts`), namespace `/realtime`, function-form auth, outbox drain на reconnect.
- **Карта:** `react-native-maps` + H3 клъстери.
- **Push:** Firebase Cloud Messaging (Android + iOS APNs proxy).
- ⚠️ **Бележка за дълга:** токените са в **некриптиран** AsyncStorage — pre-TestFlight hardening.

### 2.2 Backend (`apps/backend/`)
- **NestJS 11 · TypeScript 5.5 · Node ≥22.13.**
- **TypeORM 0.3 само като `DataSource.query()`** — суров параметризиран SQL, без entities/repositories (схемата ползва H3 generated колони + materialized views).
- **20 feature модула** (auth, users, discovery, presence, interactions, chat, messaging, notifications, alerts, geofences, feed, trending, gamification, challenges, achievements, gifts, verification, id-verification, subscriptions, social).
- **Realtime gateway in-process** със REST (един `main.ts`, Socket.IO на същия HTTP server, порт 3001). Двусервизният split е **планиран, не построен**.
- **Грешки** → `{ statusCode, code, message, details? }` (`AllExceptionsFilter`). **Validation** → `ValidationPipe(whitelist, transform, forbidNonWhitelisted)`. **Rate limit** → `@nestjs/throttler` (120 req/60s глобално + per-endpoint).

### 2.3 Данни и инфраструктура
- **PostgreSQL 16 + PostGIS + H3-PG.** `geography(Point,4326)` + H3 cell колони r5/7/9/10 + GIST индекси. Миграции `0001`–`0021` (следваща свободна `0022`).
- **Redis 7** — presence ZSET-и (per H3 r8 cell, 120s TTL), pub/sub, rate limiting.
- **S3** (presigned URLs, eu-north-1) за аватари/галерия/верификация.
- **Auth:** JWT access 15m + opaque rotating refresh 30d (family tracking + revocation). Google OAuth live; Apple Sign-In **премахнат** (`0019`).
- **Payments:** Stripe **subscriptions** (test mode, tier само през verified webhook).
- **Verification:** Twilio Verify (phone OTP) + ID-document (selfie + ID → S3, **manual review**).
- **Observability:** Sentry на двата апа (PII-scrubbed). Структуриран Pino логинг **отложен** (debt C3).
- **Deploy:** Render (`g88-api` + `g88-redis`), Supabase managed Postgres, GitHub Actions CI (lint + typecheck **блокиращи**).

### 2.4 Приватностни инварианти (нямат легаси аналог — твърди)
1. Точни GPS никога не влизат в БД — fuzz до H3 r10 центроид при запис.
2. Локация + токени никога не попадат в Sentry (`sendDefaultPii: false`, scrub преди send).

---

## 3. Архитектура на данните: легаси таблици → реална схема

Легаси планът предлагаше плоски таблици (`users`, `user_locations`, `posts`, `chats`, `messages`, `push_tokens`). Реалната схема е по-богата и геопространствена.

| Легаси таблица | Реален еквивалент | Ключова разлика |
|----------------|-------------------|-----------------|
| `users` | `users` (+ profile колони, `subscription_tier`, verification статус) | Аватар/галерия през S3 presigned, не URL колона; интереси нормализирани. |
| `user_locations (lat,lng)` | presence в **Redis ZSET** + H3 cell колони | **Точни координати не се персистират.** Дискавъри минава през `v_discoverable_entity` view. |
| `posts (lat,lng,radius)` | `alerts` + `geofences` + `feed` агрегация | Area-постовете са „alerts“; радиус-таргетирането е през H3/geofence, не raw radius scan. |
| `chats` / `messages` | `conversations` / `messages` (persisted) | Permission gate (match ∨ interest overlap), pending message requests, idempotency за outbox. |
| `push_tokens` | `notifications` модул (FCM device-token registry) | Send-on-offline fallback за waves/chat. |
| — (нямаше) | `gamification`, `challenges`, `achievements`, `gifts`, `id_verification`, `subscriptions`, `social` | Цял P3/P4 слой, който легаси планът отлагаше за v3–v5. |

**Решение за `0022` (следваща миграция):** всяка нова таблица спазва H3-generated-column конвенцията + GIST индекс, ако носи локация. Без raw `lat/lng` колони, достъпни за заявка извън fuzz-ната проекция.

---

## 4. Forward plan — P2: Pre-launch hardening (активен фронт)

Цел: **TestFlight-ready build**. Подредени, всеки затваря чисто преди следващия (виж `ROADMAP.md` P2).

| ID | Елемент | Състояние | Остатъчна работа |
|----|---------|-----------|------------------|
| P2.A4 | Dev-secret cleanup | ✅ done | — |
| P2.OB1 | Sentry (двата апа) | ✅ done | — |
| ~~P2.A3~~ | ~~Apple Sign-In~~ | ❌ cut | iOS submission ще изисква пре-решение (Apple Guideline 4.8): re-add Apple, drop Google на iOS, или email-only на iOS. **Android-first → не блокира сега.** |
| P2.C6 | Mobile chat outbox | ✅ done | Verify под flaky network в QA. |
| P2.M1 | Viewport-diff map протокол | ✅ done | Verify при city density (Varna). |
| **P2.C2 (gate)** | ≥1 `.spec.ts` на backend модул | 🟡 **отворен** | `id-verification` и още модули нямат specs. **Това е gate-ът, който още държи P2.** |

### 4.1 Конкретни действия (имплементационно)
- **C2 (тестово покритие):** за всеки модул без spec → минимум happy-path + 1 error-path тест срещу service слоя (`DataSource.query` мокнат или срещу docker Postgres). Приоритет: `id-verification`, `subscriptions` (webhook signature), `gifts` (атомарен wallet debit).
- **Mobile token hardening:** мигрирай `tokenStore` от plain AsyncStorage към `react-native-keychain` (или encrypted storage) **преди** публичен TestFlight. Native dep → изисква Android rebuild, не само Metro reload (RN 0.83/React 19 — v-ни всяка native зависимост).
- **Synthetic gate:** `synthetic-monitor.yml` (cron */5: login→discovery→wave→chat срещу прод) трябва да е зелен 7 дни. Държи го като release gate.

---

## 5. Forward plan — P3: Извеждане на habit-forming слой (post-launch)

**Ключово прозрение:** backend-ът за P3 вече съществува в репото. Работата е **mobile surfacing + spec преди код**, не зелено поле.

| Епик | Backend | Mobile остатък | Бележка |
|------|---------|----------------|---------|
| Геймификация (XP/levels/streak/leaderboard) | ✅ `/gamification/*` | Изведи Leaderboard/Achievements екрани изцяло; вържи `POST /gamification/ping` в hot-path-овете. | Не третирай „модулът съществува“ като „done“. |
| Challenges | ✅ `/challenges/today` | Challenges screen shipped; разшири с completion flow. | |
| Achievements | ✅ `/achievements` | Catalog + unlock state UI. | |
| Gifts (XP-funded) | ✅ end-to-end (backend+mobile+realtime+push) | **Shipped.** Paid gifts → P4 (cut). | Dual-balance wallet, атомарен debit. |
| Notifications/Geofences | ✅ `/geofences`, FCM | Geofence-triggered push UX + настройки on/off. | |
| Trending | ✅ `/trending/nearby` (Redis 5-min cache) | Изведи в Pulse/Map. | |
| Social linking | ✅ `/social/*` (HMAC state) | G4 deferred — link UI. | |

### 5.1 Правило за P3 (от `ROADMAP.md`)
Всеки P3 епик получава **пълен `SPECIFICATION.md` запис преди да се пише код**. Surfacing-ът минава през реалните контракти в `@g88/shared` (добавяне на untyped socket event = compile error).

---

## 6. Forward plan — P4+: Хоризонт (само документиран — без go-ahead)

Това са „котви за решения «не сега»“, не ангажименти. **Не строй без изрично одобрение** (виж `ROADMAP.md` cuts list).

- **Монетизация:** Stripe **Connect** (marketplace такси на trades) + платени подаръци. Gated на retention.
- **Live streaming:** WebRTC/RTMP → CDN (Mux/Agora/AWS IVS). Легаси v3 идея — нула код днес.
- **Matching/dating слой:** scoring `f(common_interests, distance, interaction_history, recency)`. Сигналите частично съществуват (интереси, чат история); алгоритъмът — не.
- **Community insights / recommendation engine:** изисква event-tracking таблица + batch агрегация по geohash/grid. Семената са в `feed`/`trending`.
- **Бизнес акаунти, group chat, web client, двусервизен realtime split.**

**Отложен стек (не въвеждай без дискусия):** Stripe Connect · Elasticsearch · Kafka/RabbitMQ · gRPC · Kubernetes/Terraform · GraphQL · InfluxDB · Prometheus/Grafana/Loki · SendGrid · live streaming · group chat · web client.

---

## 7. Реконсилиращи рискове и технически дълг

### 7.1 Номерация на фазите — изравнена ✅ (2026-06-10)
- **Бивш проблем:** `STATUS.md` ползваше `P3/P4/**P5**` като ad-hoc sprint етикети, които не съвпадаха с дефинициите в `ROADMAP.md` (P1–P4+; **няма P5**).
- **Разрешено:** `ROADMAP.md` е фиксиран като authoritative за sequence; добавена е „Phase-vocabulary reconciliation“ таблица в началото на `STATUS.md`, която мапва легаси етикетите към реалните фази. `ROADMAP.md` носи насрещна препратка + бележка, че P3/P4 backend е построен предсрочно (остатъкът е mobile surfacing, не greenfield).
- **Остатъчно правило:** Gap-list ID-тата (C2, OB1, M1 …) са item ID-та, не фазови номера — не се пипат. Историческите changelog записи в `STATUS.md` остават verbatim; четат се през мапинг таблицата.

### 7.2 Известен дълг (от `STATUS.md` / `AUDIT.md`)
- **C2** — липсват `.spec.ts` за част от модулите (gate за P2). **Най-висок приоритет.**
- **C3** — структуриран request логинг (Pino → Loki/Grafana) отложен; `console.*` още позволен client-side до `logger` shim.
- **Mobile токени** в некриптиран AsyncStorage (pre-TestFlight).
- **`0020_id_verification.sql` не е идемпотентна** (вече приложена — не я пускай повторно). ID-верификацията няма автоматичен `pending → verified` (само manual review).

### 7.3 App Store риск
Google OAuth е live без Apple Sign-In → всяка iOS submission удря Apple Guideline 4.8. Android-first го отлага, не го решава.

---

## 8. Обновени user stories (заменят легаси §3)

Легаси историите за v1 са **изпълнени**. Активният backlog (P2/P3):

**P2 — hardening**
- Като инженер искам ≥1 spec на backend модул, за да затворя C2 gate и да пусна TestFlight.
- Като потребител искам съобщенията ми да оцеляват при airplane mode и да се изпращат точно веднъж при възстановена мрежа (C6 — done, под QA).
- Като security owner искам токените да са в keychain, не в plain storage, преди публичен build.

**P3 — surfacing (acceptance criteria преди код, в `SPECIFICATION.md`)**
- Като потребител искам да виждам XP/level/streak и leaderboard, за да имам причина да се връщам.
- Като потребител искам дневни challenges с completion flow.
- Като потребител искам geofence push с on/off настройка, за да не ме спами.

**Формат за всяка нова история:** „Като <роля> искам <действие>, за да <стойност>“ + explicit acceptance criteria + риск/митигейшън (персона-конвенция).

---

## 9. Какво НЕ е в обхвата сега (anti-scope)

Легаси планът смесваше v1 с v3–v5. Изрично извън текущия фронт:
- Marketplace UI, listings, escrow, Stripe Connect.
- Live streaming (нула код).
- Dating/matching алгоритъм.
- Community insights дашборди, recommendation ML.
- Web/desktop client, group chat, двусервизен realtime деплой.

Тези остават в `ROADMAP.md` като „не сега“ — отварят се само след устойчив P3 retention.

---

## 10. Препратки

| Въпрос | Източник |
|--------|----------|
| Защо е така? Системен дизайн | `ARCHITECTURE.md` |
| Къде сме сега (live) | `STATUS.md` |
| Последователност + гейтове | `ROADMAP.md` |
| Per-feature контракти | `SPECIFICATION.md` |
| Какво/защо, target users | `PRODUCT.md` |
| Схема на БД | `apps/backend/migrations/0001_initial.sql` |
| API DTO + socket контракти | `packages/shared/src/` |
| Одит снапшот | `AUDIT.md` |
| Деплой/инфра | `DEPLOY.md` |

> Легаси документите (`uploads/технически план.txt`, `app MVP v1.html`) са **исторически** — описват изходната визия, не текущия код. Този план ги замества за инженерни цели.
