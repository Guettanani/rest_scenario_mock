# Plan: docker-compose.yml Full-Stack Orchestration

## Objective

Create a single `docker-compose.yml` at the project root that orchestrates the full-stack application (frontend + backend) with:
- **Backend** service → host port **8002**
- **Frontend** service (nginx) → host port **3001**
- Both on the same Docker network
- Zero modifications to any source file

## Port Reconciliation Analysis

| Component | Internal Port | Host Port | Notes |
|-----------|--------------|-----------|-------|
| nginx (frontend) | 80 | **3001** | Serves SPA + reverse-proxies `/api/*` |
| FastAPI (backend) | 8000 | **8002** | Must listen on 8000 to match nginx.conf |

The existing `frontend/nginx.conf` hardcodes `proxy_pass http://backend:8000/api/`. The backend service is named `backend` in Compose, so Docker DNS resolves it. The backend's Dockerfile.rest defaults to port 3001 — overridden in Compose `command` to `--port 8000`.

## Service Definitions

### `backend` service
- **Build**: `context: .`, `dockerfile: Dockerfile.rest`
- **Image**: `vr-scenario-lib:rest-latest`
- **Container name**: `vr-scenario-lib-backend`
- **Ports**: `"8002:8000"` (host:container)
- **Command override**: `--host 0.0.0.0 --port 8000 --docs-dir /app/documents --faiss-dir /app/faiss_index --scenarios-dir /app/scenarios`
- **Environment**: Same as existing `docker-compose.rest.yml` (HF_TOKEN, OPENROUTER_*, etc.)
- **Volumes**: documents (ro), output, scenarios, faiss-cache
- **Healthcheck**: `curl -f http://localhost:8000/health`
- **Restart**: `unless-stopped`
- **Resource limits**: 4G RAM, 2 CPUs

### `frontend` service
- **Build**: `context: ./frontend`, `dockerfile: Dockerfile`
- **Image**: `vr-scenario-lib:frontend-latest`
- **Container name**: `vr-scenario-lib-frontend`
- **Ports**: `"3001:80"` (host:container)
- **Depends on**: `backend` (condition: service_healthy)
- **Healthcheck**: `wget -qO- http://127.0.0.1/`
- **Restart**: `unless-stopped`

### Networking
- Single bridge network: `vr-scenario-lib-app-network`
- Both services attached to it
- `backend` hostname resolves within the network

### Volumes
- `faiss-cache` — persistent FAISS index
- `./documents` — read-only host documents
- `./scenarios` — scenario output
- `./output` — general output

## Request Flow

```
Browser → localhost:3001 → nginx:80
  ├─ /api/v1/scenarios → proxy_pass → http://backend:8000/api/v1/scenarios → FastAPI
  ├─ /api/v1/files/upload → proxy_pass → http://backend:8000/api/v1/files/upload → FastAPI
  ├─ /api/v1/health → proxy_pass → http://backend:8000/health → FastAPI
  └─ /* → try_files → /index.html (SPA)
```

## Files to Create

1. **`docker-compose.yml`** — at project root (`C:\Users\toufik.guettari\.gemini\antigravity-ide\scratch\vr_scenario_lib_rest\docker-compose.yml`)

## Files NOT Modified (zero changes)

- `frontend/nginx.conf` — already has `proxy_pass http://backend:8000/api/`
- `frontend/Dockerfile` — already builds correctly
- `frontend/src/services/*.js` — already use relative `/api/v1/` paths
- `Dockerfile.rest` — already builds correctly
- `vr_scenario_lib/rest_server.py` — already serves on configurable port
- All other application files

## Verification

1. `docker compose up --build -d` starts the full stack
2. `curl http://localhost:3001/` → frontend SPA HTML
3. `curl http://localhost:3001/api/v1/health` → backend health JSON
4. `curl http://localhost:8002/health` → backend health JSON (direct)
5. `curl http://localhost:3001/api/v1/scenarios` → scenario list JSON
