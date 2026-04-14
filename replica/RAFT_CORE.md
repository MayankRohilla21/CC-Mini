# RAFT Core & Replication – Implementation Guide

## TL;DR – What This Module Does

1. Maintains a **distributed cluster of replicas**
2. Elects a **leader using RAFT consensus**
3. Ensures **fault tolerance through leader re-election**
4. Replicates **stroke data across all nodes**
5. Guarantees **consistency via majority commit**
6. Supports **node recovery using log synchronization (`/sync-log`)**

---

# 1. System Overview

Each replica runs a Node.js server with the following responsibilities:

- Maintain its own **state (Follower / Candidate / Leader)**
- Participate in **leader election**
- Send and receive **heartbeats**
- Handle **log replication**
- Respond to **client requests (only if leader)**

All replicas run identical code, differentiated only by:

```
PORT=5001, 5002, 5003
ID=node1, node2, node3
```

---

# 2. RAFT State Machine

Each node can be in one of three states:

### FOLLOWER

- Default state
- Responds to leader heartbeats
- Votes during elections

### CANDIDATE

- Triggered when election timeout expires
- Requests votes from other nodes
- Becomes leader if majority achieved

### LEADER

- Sends periodic heartbeats
- Accepts client requests
- Replicates log entries

---

# 3. Leader Election Logic

### Election Trigger

- If no heartbeat received within **500–800ms**
- Node becomes candidate

### Voting Process

- Candidate increments its term
- Sends `/request-vote` to all peers
- Each node votes if:
  - It hasn’t voted already
  - Candidate’s term is valid

### Majority Rule

- In a 3-node system:
  - Majority = 2 votes

- Candidate becomes leader if ≥ 2 votes

---

# 4. Heartbeat Mechanism

Leader sends periodic heartbeats:

```
POST /heartbeat
```

Purpose:

- Maintain authority
- Prevent new elections
- Update followers with current term

Followers:

- Reset election timer on heartbeat
- Stay in FOLLOWER state

---

# 5. Log Replication (Core Concept)

### What is a Log Entry?

A log entry represents a **stroke**:

```json
{
  "x": 120,
  "y": 80,
  "prevX": 118,
  "prevY": 79,
  "color": "#000000",
  "size": 3
}
```

Each stroke = one entry in the distributed log

---

### Replication Flow

1. Client sends stroke → Leader (`/stroke`)
2. Leader:
   - Appends to its log
   - Sends to followers (`/append-entries`)

3. Followers:
   - Append entry locally

4. Leader:
   - Waits for **majority success**
   - Commits entry

---

### Commit Rule

```text
If successCount ≥ 2 → commit entry
```

Only the leader commits entries.

---

# 6. API Endpoints

## 6.1 Leader Election

### POST `/request-vote`

Request:

```json
{
  "term": 2,
  "candidateId": "node1"
}
```

Response:

```json
{
  "voteGranted": true,
  "term": 2
}
```

---

## 6.2 Heartbeat

### POST `/heartbeat`

```json
{
  "term": 2,
  "leaderId": "node1"
}
```

---

## 6.3 Log Replication

### POST `/append-entries`

```json
{
  "term": 2,
  "leaderId": "node1",
  "entry": { ...stroke }
}
```

---

## 6.4 Client Write (Leader Only)

### POST `/stroke`

Request:

```json
{ ...stroke }
```

Response:

```json
{
  "success": true,
  "entry": { ...stroke }
}
```

If not leader:

```json
{
  "error": "Not leader",
  "leaderId": "node1",
  "term": 2
}
```

---

## 6.5 Leader Discovery

### GET `/leader`

```json
{
  "leader": "node1",
  "term": 2,
  "state": "LEADER"
}
```

---

## 6.6 Log Sync (Recovery)

### GET `/sync-log`

```json
{
  "log": [...],
  "term": 2
}
```

Used by restarted nodes to catch up.

---

# 7. Log Synchronization (Failure Recovery)

### Problem

When a node restarts:

- It loses its log
- Becomes inconsistent with cluster

---

### Solution

1. Node starts
2. Calls `/sync-log` on peers
3. Copies leader’s log
4. Updates its term

---

### Example

```text
node3 restarts
→ requests /sync-log from node1
→ receives full log
→ updates local log
```

---

### Important Note

If only one node is running:

```
node1 → tries syncing from:
http://localhost:5002/sync-log
http://localhost:5003/sync-log
```

These fail → logs:

```
Sync failed
```

This is **expected behavior**, not an error.

---

# 8. Fault Tolerance

### Leader Failure Scenario

1. Leader crashes
2. Followers stop receiving heartbeat
3. After timeout:
   - One becomes candidate
   - Starts election

4. New leader elected

---

### Result

- System continues operating
- No manual intervention needed

---

# 9. File Responsibilities

## server.js

- Entry point of replica
- Starts Express server
- Initializes RAFT system

---

## state.js

- Stores node state and metadata
- Tracks:
  - current term
  - voted candidate
  - current leader

---

## timers.js

- Handles election timeout
- Controls heartbeat intervals
- Triggers elections

---

## raft.js

- Implements RAFT algorithm
- Handles:
  - election
  - voting
  - leader promotion
  - heartbeat sending

- Controls replication logic

---

## routes.js

- Defines all API endpoints
- Handles:
  - voting
  - heartbeat
  - replication
  - client requests

---

## log.js

- Stores all replicated entries
- Supports:
  - append
  - commit
  - retrieval
  - sync

---

# 10. System Flow (End-to-End)

```
Frontend → Gateway → Leader (/stroke)
Leader → Followers (/append-entries)
Followers → Leader (ack)
Leader → commit
Gateway → broadcast to clients
```

---

# 11. Key Guarantees

- Only one leader at a time
- Majority agreement required for commit
- Automatic recovery from failures
- Consistent state across replicas

---

# 12. My Role

- Implemented the **RAFT consensus mechanism**
- Designed **leader election and state transitions**
- Built **heartbeat and failure detection system**
- Developed **log replication and commit logic**
- Added **log synchronization (`/sync-log`) for recovery**
- Ensured **fault tolerance and consistency across nodes**

---

# 13. Summary

This module implements a simplified RAFT-based distributed system that ensures:

- Reliability
- Consistency
- Fault tolerance

It acts as the **core engine** of the collaborative whiteboard system.

---
