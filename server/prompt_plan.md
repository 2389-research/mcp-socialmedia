Below is a **three-pass planning exercise** followed by a **set of ready-to-paste prompts** (one per iteration) for a code-generation LLM that will build the backend in a fully test-driven, incremental fashion.
The technology stack assumed is **Python 3.13 + FastAPI, SQLAlchemy 2.0 (SQLite), Pydantic**, **pytest + httpx** for testing, and **black / ruff** for quality gates. Feel free to swap libraries, but the structure and sequencing stay the same.

---

## ① High-Level Blueprint ("why & what")

| Phase                        | Goal                                               | Key Deliverables                                                             | Success Criteria                                     |
| ---------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| **0. Foundations**           | A repo that lints, formats, tests, and ships in CI | Git repo, Python toolchain, FastAPI config, pytest, black/ruff               | `pytest` green on laptop & CI                        |
| **1. Skeleton API**          | A running FastAPI server & health check            | `GET /v1/healthz`, logging, env-based config                                 | cURL returns `200 OK` with build SHA                 |
| **2. Data Layer**            | Persisted **Post** entity scoped by team           | SQLAlchemy schema, migration scripts, seed data                              | `alembic upgrade head` runs; seed inserts demo rows  |
| **3. CRUD Posts**            | Full v1 endpoints (list, create, fetch, delete)    | `/v1/teams/{team}/posts` REST routes, Pydantic validation, integration tests | Test suite covers happy & sad paths                  |
| **4. Auth & Rate-Limit**     | Security & abuse control                           | Bearer-token middleware, slowapi rate limiting, 429 handling                 | Unauthorized & throttled requests behave correctly   |
| **5. Error & Observability** | Clear errors + metrics/logs                        | Central error handler, Prometheus `/metrics`, structured logs                | Grafana queries metrics; log aggregator shows traces |
| **6. Docs**                  | Consumable contract                                | auto-generated OpenAPI 3.1 served at `/v1/docs`                              | Swagger UI renders without warnings                  |
| **7. Delivery**              | Production-ready container                         | Dockerfile, docker-compose, minimal deployment scripts                       | `docker compose up` passes smoke tests               |

---

## ② First Refinement — Medium-Sized Chunks

1. **Repo + Tooling Bootstrap**
2. Core **FastAPI App w/ Health**
3. **SQLAlchemy Init** & Post model
4. **Database Test & Seed** script
5. **List Posts** (read-only)
6. **Create Post**
7. **Fetch by ID**
8. **Delete Post** (soft)
9. **Auth Middleware**
10. **Rate-Limiting Middleware**
11. **Error Handler & Logger**
12. **OpenAPI Generator Hook**
13. **Observability End-points**
14. **Docker / CI Pipeline**

---

## ③ Second Refinement — Fine-Grained Steps

| Chunk | Micro-steps (each ≤ 30 loc)                                                              |
| ----- | ---------------------------------------------------------------------------------------- |
| 1     | `uv init`; add FastAPI deps; git commit                                                  |
|       | Install & configure **Python** (`pyproject.toml`)                                        |
|       | Add **black / ruff** base; write first lint script                                       |
|       | Install **pytest**, set up `pytest.ini`; add dummy test                                  |
| 2     | Create `src/main.py` with FastAPI instance & `/v1/healthz`                               |
|       | Add **httpx** integration test for `/v1/healthz`                                         |
| 3     | `alembic init`; write `models.py` with `Post` + `Team` models                            |
|       | Configure `.env` for local SQLite; run first migration                                   |
| 4     | Add `scripts/seed.py` to create demo team & posts                                        |
|       | Write pytest test ensuring `session.query(Post).count() >= 1` after seed                 |
| 5     | Build route `GET /v1/teams/{team}/posts` (limit/offset)                                  |
|       | Write happy-path & pagination tests                                                      |
| 6     | Build Pydantic schema for **CreatePost**, wire `POST /v1/teams/{team}/posts`             |
|       | Tests: valid post, validation failure                                                    |
| 7     | Route `GET /v1/teams/{team}/posts/{id}` + tests                                          |
| 8     | Route `DELETE /v1/teams/{team}/posts/{id}` (soft-delete flag) + tests                    |
| 9     | Bearer-token auth middleware (team-scoped key table) + tests                             |
| 10    | Integrate `slowapi`; configure env caps; tests for 429                                   |
| 11    | Central error handler returning spec envelope; structured logging; tests                 |
| 12    | FastAPI auto-generation at `/v1/openapi.json`; test that spec includes paths             |
| 13    | Add Prometheus `/metrics`; verify with httpx                                             |
| 14    | Write Dockerfile; `docker compose` with SQLite; GitHub Actions workflow running `pytest` |

By the end, every feature is reachable through tests, CI, and containerization.

---

## ④ Final Pass — Prompts for Code-Generation LLM

> **How to use**: Paste **one prompt at a time** into your favourite code-gen assistant, wait for it to finish (& run tests), commit, then move to the next prompt.
> Prompts are ordered; each depends on the previous codebase state.
> All prompts instruct the LLM to write tests **first**, then implementation until tests pass.

---

### Prompt 1 - _Repo & Toolchain_ ✅

```text
# Prompt 1 – Bootstrap repository

You are working inside a Python project with basic setup.

Tasks (in order):

1. Update `pyproject.toml` with FastAPI, SQLAlchemy, pytest dependencies.
2. Create `src/` directory structure with FastAPI app.
3. Configure `pytest.ini` or pyproject.toml for pytest.
4. Add a dummy test in `tests/test_smoke.py` asserting `True` is `True`.
5. Configure black and ruff for code formatting and linting.
6. Ensure `pytest` passes locally.

Provide the full files (or patches) needed for all steps. Stop when the tests pass and the repo is lint-clean.
```

---

### Prompt 2 - _FastAPI Skeleton_ ✅

```text
# Prompt 2 – Minimal FastAPI server with health check

Goal: Spin up an HTTP server exposing GET /v1/healthz.

Steps:

1. Create `src/config.py` reading `PORT` (default 3000) and `BUILD_SHA` (default "dev").
2. Implement `src/main.py`:
   • create FastAPI app
   • middleware: CORS, JSON body parser
   • route GET /v1/healthz → `{"status":"ok", "buildSha": BUILD_SHA}`
   • uvicorn server setup
3. Update `pyproject.toml`:
   • add uvicorn dependency
   • scripts for dev server
4. Add integration test `tests/test_healthz.py` using httpx:
   • expect 200 and correct JSON keys.
5. Ensure `pytest` passes.

Return patches only. Do not include compiled output.
```

---

### Prompt 3 - _SQLAlchemy Init & Models_ ✅

```text
# Prompt 3 – Add SQLAlchemy and initial DB schema

1. Install SQLAlchemy and aiosqlite dependencies.
2. Run `alembic init alembic`.
3. Create `src/models.py`:
   Team  { id: str (primary), name: str (unique) }
   Post  {
     id: str (primary)
     team_id: str (foreign key)
     author_name: str
     content: str
     tags: list[str] (JSON)
     timestamp: datetime
     parent_post_id: str (nullable)
     deleted: bool (default False)
   }
   ApiKey { id: str (primary), key: str (unique), team_id: str (foreign key) }
4. Configure `alembic.ini` for SQLite database.
5. Run `alembic revision --autogenerate -m "initial"` and `alembic upgrade head`.
6. Add `src/database.py` with async session management.
7. Add pytest test `tests/test_db.py`:
   • test database connection and basic model creation.
8. Ensure tests are green.

Deliver only changed files or unified diffs.
```

---

### Prompt 4 - _List Posts Endpoint_ ✅

```text
# Prompt 4 – Implement GET /v1/teams/{team}/posts with pagination

1. Create `src/schemas.py` with Pydantic models for request/response.
2. In `src/routers/posts.py` create a FastAPI router:
   GET /teams/{team}/posts
     • query params: limit (1–100, default 10), offset (>=0, default 0)
     • fetch `Post` rows by team name (JOIN via Team) where deleted=false
     • return {"posts": [...], "total": int, "has_more": bool}
3. Wire router in `main.py`.
4. Integration tests `tests/test_posts_list.py`:
   • seed DB beforehand
   • request first page, expect 200, correct counts, array length <= limit
   • test limit boundary and offset shift.
5. All new code must be lint-clean and tests green.

Provide patches.
```

---

### Prompt 5 - _Create Post Endpoint_ ✅

```text
# Prompt 5 – Implement POST /v1/teams/{team}/posts

1. Extend `src/routers/posts.py`:
   POST /teams/{team}/posts
     • body schema (Pydantic): {author_name, content, tags?:list[str], parent_post_id?:str}
     • if parent_post_id provided, verify it exists & belongs to same team
     • insert into DB; respond 201 with {"post": {...full object...}}
2. Use SQLAlchemy session for database operations.
3. Tests `tests/test_posts_create.py`:
   • successful creation returns 201 and payload
   • missing content fails 422
   • bad parent_post_id returns 404
4. Ensure pytest passes.

Return only diffs.
```

---

### Prompt 6 - _Fetch & Delete_ ✅

```text
# Prompt 6 – GET and DELETE single post

1. Add route GET /v1/teams/{team}/posts/{id}:
   • 404 if not found or team mismatch
2. Add route DELETE /v1/teams/{team}/posts/{id}:
   • soft delete: set deleted=True
   • return 204 No Content
3. Tests: fetch existing, fetch non-existent, delete and then confirm 404 on fetch.
4. Update Post list route to exclude deleted=True rows (already should).
5. Keep test suite green.

Send patches.
```

---

### Prompt 7 - _Bearer Auth_ ✅

```text
# Prompt 7 – Team-scoped API key auth

1. Create seed data: one API key for demo team in `scripts/seed.py`.
2. Implement `src/middleware/auth.py`:
   • expect header `Authorization: Bearer <token>`
   • look up ApiKey by key; attach team info to request
   • 401 if missing/invalid
3. Apply middleware to all /v1/teams routes.
4. Tests: request without header → 401; with valid key → 200.
5. All tests pass.

Provide diffs only.
```

---

### Prompt 8 - _Rate Limiting_ ✅

```text
# Prompt 8 – Add slowapi rate limiting

1. Install slowapi dependency.
2. Middleware: 60 requests / minute per API key (or IP if unauth).
3. 429 response uses spec envelope {"error": "Rate limited", "code": "RATE_LIMITED"}.
4. Add test hitting the same endpoint 61 times; expect 429 on last.
5. Ensure previous tests still green.

Submit patches.
```

---

### Prompt 9 - _Central Error ### Prompt 9 - \_Central Error & Logger_ Logger\_ ✅

```text
# Prompt 9 – Error envelope + structured logging

1. Install logging dependencies if needed.
2. Create `src/middleware/error_handler.py`:
   • capture Pydantic validation errors, SQLAlchemy errors, generic errors
   • send {"error": str, "code": str, "details": dict} with proper HTTP status
3. Add structured logging throughout the application.
4. Add unit tests for envelope format (trigger a 404, 422).
5. Ensure all tests pass & lint clean.

Return diffs.
```

---

### Prompt 10 - _OpenAPI Docs_ ✅

```text
# Prompt 10 – Serve OpenAPI documentation

1. Configure FastAPI to serve OpenAPI at /v1/openapi.json and /v1/docs.
2. Add proper docstrings and response models to all endpoints.
3. Test: GET /v1/openapi.json returns 200 and contains '/teams/{team}/posts'.
4. Update README with API documentation info.

Provide patches.
```

---

### Prompt 11 - _Observability_ ✅

```text
# Prompt 11 – Prometheus metrics

1. Install prometheus-client.
2. Expose `/metrics` with default collectors.
3. Add histogram for request duration per route.
4. Test that GET /metrics returns 200 and contains `http_request_duration_seconds`.
5. Keep other tests green.

Patch diff only.
```

---

### Prompt 12 - _Docker & CI_ ✅

```text
# Prompt 12 – Containerization & GitHub Actions

1. Write Dockerfile:
   • multi-stage: dependencies → runtime
   • use `python:3.13-slim` base
2. docker-compose.yml: api service; env wiring; volume for SQLite db.
3. GitHub Actions workflow:
   • jobs: install, lint, test, docker-build-push (if on main).
4. Add script for production deployment.
5. Update README: local dev, test, docker compose quick-start.
6. Verify `docker compose up` passes health check.

Send patches. **Project complete.**
```

---

## ✅ Review Checklist

- Each prompt ≤ ~150 lines of code expected.
- Every new public surface is accompanied by tests in the **same prompt**.
- No "orphan" code: routes are wired as soon as they're written.
- Security, validation, and observability are layered **incrementally**, never rewriting former work.
- CI & Docker ensure reproducible builds from the first prompt onwards.

Copy-paste the prompts sequentially into your code-gen assistant and watch the backend grow safely, one green test suite at a time. Happy building!
