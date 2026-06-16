# Frontend-Backend API Integration Plan

## Summary

The frontend (React/Vite) and backend (FastAPI) already exist with significant code, but the frontend's service layer calls endpoints that **do not exist** on the backend. The backend exposes a clean REST API under `/api/v1/` (health, scenarios, documents, index refresh), while the frontend services call many unrelated endpoints (auth, files, mapping, database, generate, admin, etc.). The goal is to **wire the frontend to the actual backend API** by adjusting service calls, creating an API client that talks to the real endpoints, and adding the missing backend endpoints needed by the frontend — all without deleting or overwriting any existing frontend components, styles, or logic.

## Current State Analysis

### Backend Endpoints (rest_server.py)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/api/v1/scenario/generate` | Generate VR scenario |
| GET | `/api/v1/scenario/{scenario_id}` | Get saved scenario |
| GET | `/api/v1/scenarios` | List saved scenarios |
| POST | `/api/v1/index/refresh` | Rebuild FAISS index |
| GET | `/api/v1/documents` | List indexed documents |

### Frontend Service Calls (NOT on backend)
The frontend services call many endpoints that the backend does not implement:

**authService.js** — `/auth/login`, `/auth/me`, `/auth/register`, `/auth/register/public`, `/admin/users/*`, `/admin/competences/*`, `/admin/llm-settings`, `/admin/embedding-settings`, `/config/history`

**dataService.js** — `/files/upload`, `/files`, `/files/{id}`, `/mapping/generate`, `/mapping/scenarios/{id}`, `/database/update`, `/database/review/save`, `/generate/library`, `/generate/tokens/monitoring`, `/elements/available`, `/elements/catalog`

**monitoringService.js** — `/api/v1/state/sessions/active/detailed`, `/api/v1/state/monitor/{sessionId}` (WebSocket)

**MainPage.jsx** — `/scenario` (POST), `/generate/save` (POST), `/mapping/assignments` (POST)

**ApprenantPage.jsx** — `/mapping/assignments/me` (GET)

### What EXISTS on both sides (already compatible)
- `GET /api/v1/scenarios` ← `generationService.getLibrary()` (partial match)
- `GET /api/v1/documents` ← `fileService.getSources()` (partial match)
- `POST /api/v1/scenario/generate` ← `handleGenerateScenario()` in MainPage (different path)
- `GET /health` ← discovery service (partial match)

## Approach

**Key principle: Do NOT delete or overwrite any existing frontend code.** Only add new files and modify service files to point to correct backend endpoints. All components, pages, styles, and logic remain untouched.

### Phase 1: Create a dedicated API scenario service (`scenarioService.js`)

Create a new service file that maps to the actual backend REST endpoints:

- `POST /api/v1/scenario/generate` → `scenarioService.generate(topic, customPrompt, store)`
- `GET /api/v1/scenarios` → `scenarioService.list()`
- `GET /api/v1/scenario/{id}` → `scenarioService.get(id)`
- `POST /api/v1/index/refresh` → `scenarioService.refreshIndex()`
- `GET /api/v1/documents` → `scenarioService.getDocuments()`
- `GET /health` → `scenarioService.healthCheck()`

This service will use the existing axios instance from `authService.js` (the `api` default export) so auth token injection is preserved.

### Phase 2: Update `dataService.js` to delegate to real backend

Modify the existing functions in `dataService.js` to call the actual backend endpoints instead of non-existent ones:

- `generationService.getLibrary()` → call `GET /api/v1/scenarios` and map the response shape to what the frontend expects (`items[]`, `total`, etc.)
- `fileService.getSources()` → call `GET /api/v1/documents` and map `DocumentInfo[]` to the shape expected by DocumentsPage (`id`, `titre`, `format`, `taille`, `statut`, etc.)
- `fileService.uploadSource()` → keep as-is but point to a working endpoint or gracefully handle the missing backend with a clear error
- `componentCatalogService.getAvailable()` → derive from `/api/v1/documents` or return empty gracefully
- `mappingService`, `dbModelService` → these have no backend equivalent; keep functions but make them return empty/graceful responses

### Phase 3: Update `MainPage.jsx` scenario generation call

The `handleGenerateScenario` function currently calls `api.post('/scenario', ...)` which doesn't exist on the backend. Change it to call `POST /api/v1/scenario/generate` with the correct request body (`topic`, `custom_prompt`, `store`) and map the response (`scenario_json`, `scenario_id`, `titre`, `nb_etapes`) to the existing frontend expectations.

### Phase 4: Add missing backend endpoints for critical frontend flows

Add minimal backend endpoints that the frontend critically needs:

1. **`POST /api/v1/files/upload`** — Accept file uploads, store in docs directory, trigger processing
2. **`GET /api/v1/files`** — List uploaded/processed files with status
3. **`DELETE /api/v1/files/{id}`** — Delete a file
4. **`POST /api/v1/generate/save`** — Save a validated scenario (accept JSON body, delegate to scenario_store)
5. **`GET /api/v1/generate/library`** — Alias/wrapper for `/api/v1/scenarios` with frontend-expected shape
6. **`POST /api/v1/mapping/assignments`** — Create learner-scenario assignment (stub or minimal implementation)
7. **`GET /api/v1/mapping/assignments/me`** — List assignments for current user (stub)

### Phase 5: Wire up `env.js` and Vite proxy for production parity

- Ensure `VITE_API_URL` defaults work for both dev (Vite proxy) and production (nginx proxy)
- The Vite config already proxies `/api` to `http://backend:8000` — verify this matches the backend port (currently `backend:8000` in vite config but backend defaults to port `3001`)
- Fix the Vite proxy target to match the backend's actual port

### Phase 6: Update `monitoringService.js` to use correct paths

The monitoring service calls `/api/v1/state/sessions/active/detailed` and WebSocket at `/api/v1/state/monitor/{sessionId}`. These don't exist on the backend. Either:
- Add these endpoints as stubs on the backend, OR
- Make the service gracefully handle 404s (keep all existing logic, just prevent crashes)

## Files to Modify

### Frontend (modify existing service files only)
1. `frontend/src/services/dataService.js` — Map calls to real backend endpoints
2. `frontend/src/services/env.js` — Fix API URL if needed
3. `frontend/vite.config.js` — Fix proxy target port

### Frontend (new files)
4. `frontend/src/services/scenarioService.js` — New dedicated service for scenario API

### Backend (add endpoints to existing file)
5. `vr_scenario_lib/rest_server.py` — Add missing endpoints

## Files NOT to Touch (preserve strictly)
- All page components (`frontend/src/pages/*.jsx`)
- All UI components (`frontend/src/components/*.jsx`)
- All styles (`frontend/src/styles/*.css`)
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/routes/paths.js`
- `frontend/src/App.jsx`
- `frontend/src/main.jsx`
- All test files
- `frontend/nginx.conf`
- `frontend/Dockerfile`

## Risks & Tradeoffs

- **Auth system**: The frontend has a full auth system (`/auth/login`, `/auth/register`, `/admin/*`) but the backend has no auth endpoints. The frontend's auth flow uses localStorage for tokens and the axios interceptor. This plan does NOT remove the existing auth code — it keeps it intact. The backend endpoints that need auth can be added without auth checks for now (the backend already has CORS open).
- **Many frontend features reference non-existent backend tables** (composant3D, mapping assignments, token monitoring, etc.). These will gracefully return empty data rather than crash.
- **The `handleGenerateScenario` in MainPage.jsx** is the most critical integration point — it currently sends `{ prompt, temperature, desired_steps }` to `/scenario` but the backend expects `{ topic, custom_prompt, store }` at `/api/v1/scenario/generate`.

## Verification

1. Frontend dev server starts without errors
2. `GET /health` returns data from frontend
3. Scenario generation flow works end-to-end (prompt → generate → display)
4. Documents page loads without crashes
5. All existing tests still pass
