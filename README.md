# BulkTrack API — Backend (TypeScript × Hono × Cloudflare Workers)

> **Mission Statement** Build the **fastest, most friction‑less strength‑training log** that *understands* progressive overload and
> uses data‑driven volume management to fuel muscle growth.
>
> This edition is written in **TypeScript 5 + Hono** and runs entirely on **Cloudflare Workers**.

---

## 🧐 What We Make

| Pillar                            | Why it Matters                                                                               | How it Shows Up in the Product                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **1 📓 Frustration‑free Logging** | A set should be captured in <800 ms, even offline.                                           | *Offline‑first*, single‑tap set duplication, auto‑prefill with last weights/reps, device‑ID onboarding (no account needed). |
| **2 🧮 Volume‑Centric Insights**  | Hypertrophy hinges on *effective volume*. Users need a gut‑level view of "did I do enough?" | Daily/weekly muscle‑volume aggregation, highlight under‑stimulated areas, deload warnings.                                  |
| **3 🤖 AI‑Ready Data Rails**      | Tomorrow's coach learns from your history + recovery. Clean data > fancy models.             | Normalised schema, explicit tempo/rest, deterministic IDs, recommendation log tables.                                       |
| **4 ️ Edge‑native Speed**       | Millisecond APIs worldwide without DevOps drag.                                              | **TypeScript ESM** on CF Edge, single‑regionless SQLite (**D1**), KV token cache.                                           |

---

## 🏗️ Architecture Snapshot

```mermaid
flowchart TD
  C[Client] -->|"HTTPS"| W[Edge Worker]
  W -->|D1 binding| DB[(Cloudflare D1)]
  W --> KV[(Workers KV)]
  subgraph Auth Tokens
    KV
  end
```

* **Hono** – 3 kB router/middleware stack perfect for Workers.
* **Drizzle** – SQL‑first, type‑safe ORM + migrations.
* **JWT device tokens** generated and verified using `hono/jwt`; refresh & revocation list in KV.
* **OpenAPI 3.0** (`api/openapi.yaml`) drives typed SDK via `openapi-typescript`.
* **Valibot** – Lightweight, schema-first validation library for data integrity.

---

## 🔑 Authentication & Onboarding

| Step            | Endpoint                               | Token Type                         | UX                          |
| --------------- | -------------------------------------- | ---------------------------------- | --------------------------- |
| Activate Device | `POST /v1/auth/device` + `X-Device-Id` | *Device Access* + *Device Refresh* | Zero‑tap first launch.      |
| Use API         | protected routes                       | Bearer *Device Access*             | 15 min TTL, auto refresh.   |
| Link Apple ID   | `POST /v1/auth/apple`                  | *User Access* + *User Refresh*     | Optional 1‑tap in Settings. |

Detailed claims live in `docs/auth.md`.

---

## 🗄️ Data Model Essentials

Schema matches Go build; see [`schema.sql`](schema.sql). Drizzle models reside in `src/infrastructure/db/schema/*`.

---

## 🎚️ Effective Volume Model (Stimulus × Fatigue)

### Why two coefficients?

| Column                               | Level               | Meaning                                                                                                                                                    |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`muscles.tension_factor`**         | *muscle*            | Recovery / fatigue multiplier (default **1.0**). Lower for fatigue-heavy muscles (e.g., lower back 0.7), higher for fatigue-light ones (e.g., calves 1.2). |
| **`exercise_muscles.tension_ratio`** | *exercise → muscle* | Share of a set’s tension that reaches each muscle.<br>Bench Press → Chest 1.0, Triceps 0.5, Shoulders 0.3                                                  |

### 7-day effective-volume query

```sql
SELECT
  em.muscle_id,
  SUM(ws.volume * em.tension_ratio * m.tension_factor) AS effective_volume
FROM workout_sets      ws
JOIN exercise_muscles  em USING (exercise_id)
JOIN muscles           m  ON m.id = em.muscle_id
WHERE ws.user_id = :uid
  AND ws.created_at >= date('now','-7 day')
GROUP BY em.muscle_id;
```

The Aggregator Worker runs this nightly to update `muscle_volumes_day`, feeding the dashboard heat-map and future AI recommendations.

---

## 📂 Repo Layout — Clean Architecture / DDD

<details>
<summary> Expand full tree</summary>

```text
├── src/
│   ├── domain/                    # Pure business logic (no runtime imports)
│   │   ├── exercise/
│   │   │   ├── entity.ts
│   │   │   ├── repository.ts      # interface / port
│   │   │   └── service.ts
│   │   ├── workout/
│   │   │   ├── entity.ts
│   │   │   └── service.ts
│   │   └── shared/vo/             # Value objects (IDs, units) – Zod‑validated
│   ├── app/                       # Application layer (CQRS)
│   │   ├── command/
│   │   │   ├── exercise/
│   │   │   │   └── create-exercise.ts
│   │   │   └── session/
│   │   │       ├── start-session.ts
│   │   │       └── finish-session.ts
│   │   ├── query/
│   │   │   └── exercise/
│   │   │       └── search-exercise.ts
│   │   ├── dto/
│   │   └── errors/
│   ├── interface/                 # Delivery layer
│   │   └── http/
│   │       ├── router.ts          # Hono router composition
│   │       ├── middleware/
│   │       │   ├── auth.ts
│   │       │   ├── cors.ts
│   │       │   └── logging.ts
│   │       └── handlers/
│   │           ├── auth/
│   │           │   ├── device.ts
│   │           │   └── apple.ts
│   │           ├── exercise/
│   │           │   ├── create.ts
│   │           │   └── search.ts
│   │           ├── session/
│   │           │   ├── start.ts
│   │           │   ├── finish.ts
│   │           │   └── sets.ts
│   │           └── dashboard/stats.ts
│   └── infrastructure/
│       ├── db/
│       │   └── schema.ts
│       ├── kv/token-store.ts
│       ├── auth/jwt-service.ts
│       └── logging/logger.ts
├── drizzle/                        # Migration files
├── api/
│   └── openapi.yaml
├── docs/
│   ├── auth.md
│   └── architecture.md
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   └── gen-openapi-types.sh
├── wrangler.toml
├── tsconfig.json
├── package.json
└── README.md
```
</details>

### Layer Rules

1. **Domain** imports nothing outside `src/domain`. Pure functions & entities.
2. **Application** orchestrates domain objects via commands/queries; depends only on domain ports.
3. **Interface** owns HTTP concerns (Hono handlers), maps HTTP ↔ DTO.
4. **Infrastructure** provides concrete adapters (D1, KV, JWT, Apple verify).

### AI‑Agent Guardrails

* Create files **only in directories above**.
* Tests live beside source as `*.test.ts`.
* Generated artifacts (`dist/`, `.d.ts`) are ignored by git — do **not** commit.
* Use `const` for all variable declarations; avoid `let`.

---

## 🛠️ Local Development

```bash
pnpm i                # install deps
pnpm dev              # = wrangler dev --local --experimental-json-config
```

*Hot‑reload*, D1 in‑memory, Vitest watchers.

---

## 🧪 Testing & CI

| Layer    | Tool                                           |
| -------- | ---------------------------------------------- |
| Unit     | **Vitest** + **@hono/testing**                 |
| Contract | **Prism** mock server vs `openapi.yaml`        |
| E2E      | **k6** / **Playwright** hitting `wrangler dev` |

GitHub Actions matrix runs `vitest`, `tsc --noEmit`, ESLint, Drizzle migrations, and contract tests.
