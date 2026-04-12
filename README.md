# CC-Mini: Collaborative Whiteboard with RAFT Consensus

A distributed real-time collaborative whiteboard built with RAFT consensus protocol. Multiple users can draw simultaneously, and all strokes are synchronized via a RAFT cluster with automatic leader election and crash recovery.

## System Architecture

```
Browser 1 ──┐                    ┌─── Replica 1 (RAFT)
Browser 2 ──┼──> Gateway (WSS) ──┼─── Replica 2 (RAFT)
Browser 3 ──┘                    └─── Replica 3 (RAFT)
             Commits broadcast back to all clients
```

## Project Structure

```
CC-Mini/
├── frontend/              # Browser UI (vanilla JS + Canvas)
│   ├── index.html         # Full-screen canvas + toolbar
│   └── script.js          # WebSocket client + drawing logic
├── gateway/               # WebSocket server + RAFT routing (teammate)
├── replica1/              # RAFT consensus node (teammate)
├── replica2/              # RAFT consensus node (teammate)
├── replica3/              # RAFT consensus node (teammate)
├── docker-compose.yml     # Container orchestration (teammate)
├── README.md              # This file
└── PROGRESS.md            # Team progress tracker
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Run the System

```bash
# Start all services (gateway + 3 RAFT replicas)
docker-compose up

# In another terminal, open the frontend
open frontend/index.html
# or use: file:///path/to/CC-Mini/frontend/index.html
```

### Test with Multiple Users

1. Open `frontend/index.html` in multiple browser tabs/windows
2. Draw on one canvas - strokes appear on all canvases in real-time
3. Draw from any tab - all tabs stay synchronized

## Documentation

- **[Frontend Documentation](frontend/FRONTEND.md)** - How the frontend works, architecture, and talking points for viva
- **[Gateway Integration Guide](GATEWAY_INTEGRATION.md)** - What your Gateway must do to integrate with the frontend
3. Try killing a replica to test failover:
   ```bash
   docker stop replica1
   ```
   The system recovers automatically in ~2 seconds

## How It Works

### Frontend (Browser)
- **Canvas**: Full-screen HTML5 canvas for drawing
- **Drawing**: Mouse + touch support with smooth strokes
- **Local Rendering**: Strokes render immediately (zero lag)
- **WebSocket**: Sends each stroke to gateway
- **Receiving**: Listens for committed strokes from other users
- **Auto-Reconnect**: Retries every 2 seconds if disconnected

### Gateway → RAFT Flow
1. Client draws and sends stroke via WebSocket
2. Gateway receives stroke
3. Gateway forwards stroke to RAFT cluster
4. Replicas reach consensus (2/3 majority required)
5. Stroke is committed
6. Gateway broadcasts committed stroke to **all connected clients**
7. All canvases stay in sync

### RAFT Consensus (Teammate's Code)
- **Leader Election**: Automatic failover when leader dies
- **Log Replication**: All replicas maintain same log
- **Crash Recovery**: System recovers from any single node failure
- **Network Partition**: 2/3 majority quorum ensures consistency

## WebSocket Message Format

**Important:** Gateway team must confirm these specs.

### Client → Gateway (Drawing)
```json
{
  "type": "stroke",
  "data": {
    "x": 120,
    "y": 80,
    "prevX": 118,
    "prevY": 79,
    "color": "#000000",
    "size": 3
  }
}
```

### Gateway → All Clients (Committed)
```json
{
  "type": "commit",
  "data": {
    "x": 120,
    "y": 80,
    "prevX": 118,
    "prevY": 79,
    "color": "#000000",
    "size": 3
  }
}
```

## Frontend Features

- ✅ Full-screen canvas (resizable)
- ✅ Color picker (hex colors)
- ✅ Brush size slider (1-50px)
- ✅ Clear button (local canvas only)
- ✅ Connection status indicator (green/red)
- ✅ Smooth line drawing (uses prevX/prevY segments)
- ✅ Mouse support
- ✅ Touch support (tablets/phones)
- ✅ Auto-reconnect on disconnect
- ✅ Zero-lag local rendering
- ✅ Plain HTML/JS - no build tools needed

## Team Responsibilities

### Frontend (Mehran)
- [x] `index.html` - Canvas UI + toolbar
- [x] `script.js` - WebSocket client + drawing
- [ ] Integration testing with gateway

### Gateway (Teammate)
- [ ] WebSocket server on `ws://localhost:8080`
- [ ] Accept `stroke` messages from clients
- [ ] Forward to RAFT cluster
- [ ] Broadcast `commit` messages to ALL clients
- [ ] Handle disconnects gracefully

### RAFT Cluster (Teammate)
- [ ] replica1, replica2, replica3
- [ ] Leader election logic
- [ ] Log replication
- [ ] Consensus (2/3 majority)
- [ ] Crash recovery

## Integration Checklist

- [ ] Gateway runs on port 8080
- [ ] Gateway accepts WebSocket connections
- [ ] Gateway sends/receives correct message format
- [ ] All clients receive commits (broadcast, not unicast)
- [ ] System recovers from single node failure
- [ ] Browser reconnects after leader failover
- [ ] All canvases stay synchronized

## Debugging

### Browser Console
1. Open DevTools (`F12`)
2. Check Console tab for connection logs
3. Status indicator (top-right) shows real-time connection state

### Test Commands
```bash
# Watch gateway logs
docker logs -f gateway

# Check replica status
docker ps

# Kill a replica to test failover
docker stop replica2

# View frontend files
ls -la frontend/
```

## Tech Stack

- **Frontend**: HTML5, Canvas API, WebSocket API, Vanilla JavaScript
- **Backend**: (Teammate - likely Node.js/Python/Go)
- **Consensus**: RAFT protocol
- **Deployment**: Docker Compose

## Notes for Viva/Demo

1. **Explain the flow**: Draw → WebSocket → Gateway → RAFT → Broadcast → Sync
2. **Show failover**: Kill a replica, demonstrate ~2 second recovery
3. **Show sync**: Draw on one client, appear on others in real-time
4. **Emphasize RAFT**: Even with node failures, consensus is maintained
5. **Mention zero-lag**: Local drawing is immediate, committed strokes from others appear as they arrive

## Questions? See PROGRESS.md

Track what's done and what needs work in `PROGRESS.md`.