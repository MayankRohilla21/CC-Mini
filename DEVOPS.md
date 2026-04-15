# DevOps and Logging Runbook

## Stack Added

- `docker-compose.yml` with `gateway` + `replica1/2/3`
- Hot reload in containers using `nodemon`
- Health endpoints + healthchecks
- Structured JSON logs to stdout and mounted `logs/` folders
- Replica log sync from index (`/sync-log?from=N`)

## Prerequisites

- Docker Desktop running
- Ports free: `8080`, `8081`, `5001`, `5002`, `5003`

## Start System

```bash
docker compose up --build
```

After startup, verify health:

```bash
curl http://localhost:8081/health
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
```

## Open Frontend

Open `frontend/index.html` in 2+ browser tabs.

Expected:
- Status indicator turns green (connected)
- Drawing in one tab appears in other tabs

## Logs You Should See

### Gateway logs

- `CLIENT_CONNECTED`
- `STROKE_RECEIVED`
- `COMMIT_BROADCASTED`

### Replica logs

- `ELECTION_STARTED`
- `LEADER_ELECTED`
- `ENTRY_COMMITTED`
- `FOLLOWER_SYNCED` / `FOLLOWER_SYNC_PUSHED` (on catch-up)

## Required Test Cases (for demo)

### 1) Multi-client sync

1. Open two tabs.
2. Draw in Tab A.
3. Verify stroke appears in Tab B.
4. Draw in Tab B and verify in Tab A.

### 2) Leader failover

1. Find leader:
   ```bash
   curl http://localhost:5001/leader
   curl http://localhost:5002/leader
   curl http://localhost:5003/leader
   ```
2. Stop current leader container:
   ```bash
   docker stop replica1
   ```
   (Use the actual leader container.)
3. Wait 2-4 seconds, verify a new leader is elected.
4. Draw again and verify sync still works.
5. Restart stopped node:
   ```bash
   docker start replica1
   ```
6. Confirm catch-up log messages appear.

### 3) Hot reload without full downtime

1. Keep `docker compose up` running.
2. Edit any file under `replica/` (example: add whitespace/comment).
3. Confirm that container reloads automatically via nodemon.
4. System remains available (brief failover window acceptable).
5. Draw again and verify sync.

### 4) Gateway restart resilience

1. Stop gateway:
   ```bash
   docker stop gateway
   ```
2. Frontend should show disconnected.
3. Start gateway:
   ```bash
   docker start gateway
   ```
4. Frontend reconnects automatically in ~2 seconds.

## Inspect Mounted Log Files

```bash
ls logs
ls logs/gateway
ls logs/replica1
ls logs/replica2
ls logs/replica3
```

Each service writes structured JSON events to its own log file.

## Useful Commands

```bash
docker compose ps
docker compose logs -f gateway
docker compose logs -f replica1 replica2 replica3
docker compose down
docker compose down -v
```
