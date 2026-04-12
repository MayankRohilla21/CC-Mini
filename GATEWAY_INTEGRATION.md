# Gateway Integration Guide for Frontend

## TL;DR - What Your Gateway Must Do

1. **Listen on `ws://localhost:8080`** (WebSocket server)
2. **Receive** client messages with type: `"stroke"`
3. **Forward** strokes to RAFT Leader for consensus
4. **Wait** for RAFT commit confirmation
5. **Broadcast** committed strokes to ALL connected clients with type: `"commit"`
6. **Handle** client reconnections gracefully

---

## 1. WebSocket Server Setup

Your Gateway must expose a WebSocket server on **port 8080**:

```
Frontend connects to: ws://localhost:8080
```

### Example (Node.js with ws library):
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  // Handle messages here
});
```

### Example (Python with websockets):
```python
import asyncio
import websockets

async def handler(websocket, path):
    async for message in websocket:
        # Handle message here
        pass

start_server = websockets.serve(handler, "localhost", 8080)
asyncio.get_event_loop().run_until_complete(start_server)
```

---

## 2. Message Format: Client → Gateway

**Message Type:** `"stroke"`

### Incoming Message Structure:
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

### Field Descriptions:
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `x` | float | 0 - canvas.width | Current X coordinate |
| `y` | float | 0 - canvas.height | Current Y coordinate |
| `prevX` | float | 0 - canvas.width | Previous X (line segment start) |
| `prevY` | float | 0 - canvas.height | Previous Y (line segment start) |
| `color` | string | hex color code | Brush color (e.g., "#FF5733") |
| `size` | integer | 1 - 50 | Brush width in pixels |

### Example Handler:
```javascript
ws.on('message', (rawData) => {
  const message = JSON.parse(rawData);
  
  if (message.type === 'stroke') {
    const stroke = message.data;
    console.log(`Received stroke: (${stroke.prevX},${stroke.prevY}) → (${stroke.x},${stroke.y})`);
    
    // Forward to RAFT leader
    forwardToLeader(stroke);
  }
});
```

---

## 3. Message Format: Gateway → Client (Broadcast)

**Message Type:** `"commit"`

### Outgoing Message Structure:
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

### When to Send:
1. **After RAFT Commit**: Only send `"commit"` messages when the stroke has been replicated to a majority of replicas
2. **To ALL Clients**: Broadcast to every connected WebSocket client (including the originating client)
3. **In Order**: Maintain order—send commits in the same order as RAFT log indexes

### Example Broadcaster:
```javascript
function broadcastCommit(stroke) {
  const message = JSON.stringify({
    type: 'commit',
    data: stroke
  });
  
  // Send to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
```

---

## 4. Flow Diagram

```
┌─────────────────┐
│ Frontend        │
│ (Browser)       │
└────────┬────────┘
         │ ws.send({"type": "stroke", "data": {...}})
         ▼
┌─────────────────────────────────────────────────────┐
│ Gateway (Your Code)                                  │
├─────────────────────────────────────────────────────┤
│  1. Receive from WebSocket                          │
│  2. Parse JSON → extract stroke data                │
│  3. Forward to RAFT Leader                          │
│  4. Wait for Leader → QUORUM REPLICATE              │
│  5. Receive Leader's COMMIT confirmation             │
│  6. Broadcast to all clients ← THIS IS CRITICAL!    │
└────────┬─────────────────────────────────────────────┘
         │ ws.send({"type": "commit", "data": {...}}) [ALL CLIENTS]
         ▼
┌──────────────────┐
│ Frontend(s)      │
│ (Draw received) │
└──────────────────┘
```

---

## 5. Client Connection Lifecycle

### Connection Established
```javascript
wss.on('connection', (ws) => {
  console.log('New client connected');
  clientCount++;
  
  // Track this client
  ws.on('close', () => {
    console.log('Client disconnected');
    clientCount--;
  });
});
```

### Handling Reconnects (AUTO)
- Frontend will automatically attempt to reconnect every 2 seconds if disconnected
- No special handling needed from Gateway—just accept the new WebSocket connection
- Old connection resources are freed automatically

### Graceful Shutdown
```javascript
wss.close(() => {
  console.log('WebSocket server closed');
});
```

---

## 6. RAFT Integration Checklist

- [ ] **Receive stroke** from client (WebSocket message `type: "stroke"`)
- [ ] **Send to RAFT Leader** (call your leader's append-entries RPC or similar)
- [ ] **Wait for quorum acknowledgment** (majority of replicas have replicated)
- [ ] **Check commit status** (leader confirms entry is committed)
- [ ] **Broadcast commit** to ALL WebSocket clients (including sender) with `type: "commit"`
- [ ] **Maintain ordering** (send commits in RAFT log order, not arbitrary order)
- [ ] **Handle leader changes** gracefully (if current leader fails, new leader takes over—transparent to Gateway)

---

## 7. Key Requirements for Frontend to Work

### ✅ MUST HAVE
1. **WebSocket on port 8080** - Frontend hardcoded to `ws://localhost:8080`
2. **Accept `{"type": "stroke", ...}` messages**
3. **Send `{"type": "commit", ...}` only AFTER RAFT commits**
4. **Send commits to ALL connected clients** (broadcast)
5. **Parse and validate JSON** (frontend sends valid JSON, but safety checks are good)

### ❌ MUST NOT
1. **Modify stroke data** - Send back exactly what RAFT provides (except timing)
2. **Send "commit" before RAFT confirms** - This breaks ordering guarantees
3. **Lose messages** - Buffering strokes is OK; dropping is NOT
4. **Require authentication** - Frontend uses plain WebSocket, no auth headers

### 🟡 NICE TO HAVE
1. Logging for each stroke received/committed (helps debugging)
2. Connection count tracking
3. Stroke rate monitoring (detect spam or issues)
4. Error recovery if RAFT cluster is down

---

## 8. Testing Your Gateway Integration

### Test 1: Single Client, Confirm Broadcast
```
1. Open http://localhost:5173/frontend.html (or however frontend is served)
2. Draw a line on the canvas
3. Check Gateway logs—should see:
   - "Received stroke..."
   - "Replicating to RAFT..."
   - "Committed!"
4. Canvas should update with your stroke (feedback)
5. ✅ SUCCESS: Stroke appears on same client (loopback broadcast)
```

### Test 2: Multi-Client Synchronization
```
1. Open frontend in Tab A
2. Open frontend in Tab B (same browser or different device)
3. Draw on Tab A
4. Check Tab B canvas—should see the stroke appear
5. Draw on Tab B
6. Check Tab A—should see Tab B's stroke
7. ✅ SUCCESS: Real-time sync across clients
```

### Test 3: Reconnection Recovery
```
1. Draw on Tab A
2. Stop Gateway container (interrupt WebSocket)
3. Tab A status should show "Disconnected" (red)
4. Start Gateway again
5. Wait 2 seconds (auto-reconnect interval)
6. Tab A status should show "Connected" (green)
7. Draw on Tab A—should send successfully
8. Draw on Tab B—should receive on Tab A
9. ✅ SUCCESS: Latency-tolerant, recovers gracefully
```

### Test 4: RAFT Failover
```
1. Leader is Replica 1
2. Draw 5 strokes (all appear across clients)
3. Kill Replica 1 container
4. RAFT elects new leader (e.g., Replica 2)
5. Draw 5 more strokes on Tab A and Tab B
6. All strokes should sync (both old and new)
7. ✅ SUCCESS: Transparent failover, zero drawing downtime
```

---

## 9. Debugging Tips

### If Frontend can't connect:
```javascript
// Check browser console (DevTools → Console)
// Should log: "[Frontend] WebSocket connected successfully"

// If not, check:
1. Is your Gateway running? (docker ps | grep gateway)
2. Is port 8080 exposed? (docker-compose.yml should allocate 8080:8080)
3. Is there a firewall blocking localhost:8080?
4. Try: curl -i http://localhost:8080 (should fail in HTTP, but shows port is open)
```

### If Strokes appear but don't sync to other clients:
```
1. Check Gateway logs—are commits being sent?
2. Add logging to broadcastCommit():
   console.log("Broadcasting to", wss.clients.size, "clients");
3. Verify clients.size > 0 (at least 2 clients connected)
4. Check if commit message has correct format: {"type": "commit", "data": {...}}
```

### If RAFT ordering is wrong:
```
1. Check that commits are sent in RAFT log index order
2. Don't buffer/batch commits—send one-by-one as they commit
3. Verify leader is replaying log correctly on startup
```

---

## 10. Example Gateway Pseudocode

```javascript
const WebSocket = require('ws');

class DrawingGateway {
  constructor(port = 8080) {
    this.wss = new WebSocket.Server({ port });
    this.raftClient = new RaftClient(); // Your RAFT integration
    
    this.wss.on('connection', this.handleConnection.bind(this));
    console.log(`Gateway listening on ws://localhost:${port}`);
  }
  
  handleConnection(ws) {
    console.log('Client connected');
    
    ws.on('message', (rawData) => {
      try {
        const message = JSON.parse(rawData);
        this.handleStroke(message, ws);
      } catch (e) {
        console.error('Invalid JSON:', e);
      }
    });
    
    ws.on('close', () => console.log('Client disconnected'));
  }
  
  handleStroke(message, ws) {
    if (message.type !== 'stroke') {
      console.warn('Unknown message type:', message.type);
      return;
    }
    
    const stroke = message.data;
    console.log('Received stroke:', stroke);
    
    // Forward to RAFT leader
    this.raftClient.sendToLeader('append_stroke', stroke, (err, committed) => {
      if (err) {
        console.error('RAFT error:', err);
        return;
      }
      
      if (committed) {
        // Broadcast to all clients
        this.broadcastCommit(stroke);
      }
    });
  }
  
  broadcastCommit(stroke) {
    const message = JSON.stringify({
      type: 'commit',
      data: stroke
    });
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
    console.log('Committed and broadcasted stroke');
  }
}

// Start Gateway
new DrawingGateway(8080);
```

---

## 11. Questions for Your Gateway Team

If stuck, ask:

1. **What RAFT RPC should contain a stroke?** Typically `AppendEntries` with the stroke as the log entry.
2. **How do I know when an entry is committed?** Look for `leaderCommitIndex` in `AppendEntries` response or check a **commit index** state variable.
3. **Does the Gateway run on a replica or separately?** Typically separate, but talk to your teammates!
4. **Should the Gateway send your own stroke back (loopback)?** YES—broadcast to ALL clients, including the sender (provides feedback).

---

## Summary

| Aspect | Requirement |
|--------|------------|
| **Protocol** | WebSocket (ws://) |
| **Port** | 8080 |
| **Inbound Message** | `{"type": "stroke", "data": {...}}` |
| **Outbound Message** | `{"type": "commit", "data": {...}}` |
| **Broadcast** | To ALL connected clients |
| **RAFT Integration** | Send commit only after quorum replicates |
| **Ordering** | Maintain RAFT log order |
| **Reconnect** | Frontend auto-retries; just accept new connections |

---

## Deliverables Checklist

- [ ] **WebSocket server running on port 8080**
- [ ] **Receives strokes from frontend correctly**
- [ ] **Forwards strokes to RAFT cluster**
- [ ] **Broadcasts commits back to all clients**
- [ ] **Tested with single and multiple clients**
- [ ] **Tested failover scenario (leader dies, system recovers)**
- [ ] **Handles reconnections gracefully**
- [ ] **Logs important events for demo/debugging**

---

**Good luck! 🚀 If issues arise, check the browser console first—it often has clues.**
