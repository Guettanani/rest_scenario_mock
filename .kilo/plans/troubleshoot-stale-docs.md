# Troubleshooting Guide: Deleted Endpoints Still Visible in `/docs` (Swagger UI)

## Confirmed Current State

The `/swagar` and `/swagar/web` endpoints are **fully removed** from the source code (`vr_scenario_lib/rest_server.py`). No references exist in any project files. If they still appear in the `/docs` page, it is a caching/build issue — not a code issue.

---

## Potential Causes & Step-by-Step Fixes

### 1. Browser Caching (most common)

The browser may be serving a cached version of the Swagger UI HTML or the OpenAPI JSON (`/openapi.json`).

**Fix:**
- Hard-refresh the page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Open the URL in an incognito/private window
- Clear browser cache for the server's address
- Try appending a cache-buster query: `http://localhost:3001/docs?v=2`

### 2. Python `.pyc` Bytecode Cache

Python caches compiled bytecode in `__pycache__` directories. If the server was running before the edits and stale `.pyc` files exist, an old module version may be served.

**Fix:**
```powershell
Get-ChildItem -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem -Recurse -Filter "*.pyc" | Remove-Item -Force
```

### 3. Uvicorn Reload / Process Not Restarted

If the server is still running the old process, it will serve the old code.

**Fix:**
- Stop the running server (`Ctrl+C`)
- Ensure no stale Python processes exist:
  ```powershell
  Get-Process -Name "python*" -ErrorAction SilentlyContinue | Stop-Process -Force
  ```
- Restart the server:
  ```powershell
  python -m vr_scenario_lib.rest_server
  ```

### 4. Docker Image Layer Caching

If running via Docker Compose, the cached Docker image layers may contain the old code. The `COPY . .` layer in `Dockerfile.rest` and `Dockerfile` is only re-executed when files change **in the build context** — but Docker's layer caching can miss changes if the build cache isn't invalidated.

**Fix:**
```powershell
docker-compose -f docker-compose.rest.yml build --no-cache rest-server
docker-compose -f docker-compose.rest.yml up -d rest-server
```

Also verify the **volume mounts** in `docker-compose.rest.yml` (line 38–41) are overlaying the code correctly:
- `./documents`, `./output`, `./scenarios` are bind-mounted
- But `.` (the project root with `rest_server.py`) is NOT bind-mounted as a volume — the code comes from the Docker image itself. So a **rebuild** is required, not just a restart.

### 5. FastAPI Caching of OpenAPI Schema

FastAPI generates the OpenAPI schema at startup. If you're using a WSGI middleware or reverse proxy (e.g., Nginx, Traefik), the proxy may cache the `/openapi.json` response.

**Fix:**
- If behind a reverse proxy, restart it or purge its cache
- Access `/openapi.json` directly and inspect the JSON for `/swagar` — if it's not there, the issue is browser-side
- If using any CDN or API gateway, invalidate its cache

### 6. IDE / Editor Virtual Environment

The IDE may be running the server from a different virtual environment or Python installation than the one you edited.

**Fix:**
- Verify which Python interpreter is active:
  ```powershell
  where.exe python
  python -c "import vr_scenario_lib.rest_server; print(vr_scenario_lib.rest_server.__file__)"
  ```
- Confirm the printed file path matches the file you edited
- If different, edit the correct file or switch the working environment

---

## Verification Steps

1. **Check OpenAPI JSON directly:**
   Open `http://localhost:3001/openapi.json` and search for "swagar". It should not appear.

2. **Hit the deleted endpoints:**
   `curl http://localhost:3001/swagar` → should return `404 Not Found`
   `curl http://localhost:3001/swagar/web` → should return `404 Not Found`

3. **Run tests to confirm code integrity:**
   ```powershell
   python -m pytest tests/test_rest_server.py -v
   ```
