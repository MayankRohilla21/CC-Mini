const axios = require("axios");
const state = require("./state");

const {
  resetElectionTimer,
  startHeartbeat,
  stopElectionTimer,
  setElectionCallback,
} = require("./timers");

const peers = [
  "http://localhost:5001",
  "http://localhost:5002",
  "http://localhost:5003",
];

const id = process.env.ID || "node1";
const port = process.env.PORT;

/**
 * START RAFT SYSTEM
 */
async function startRaft() {
  setElectionCallback(startElection);

  // 🔥 Try syncing before election
  for (let peer of peers) {
    if (peer.endsWith(port)) continue;

    try {
      await syncWithLeader(peer);
      break;
    } catch (err) {}
  }

  resetElectionTimer();
}

/**
 * START ELECTION
 */
async function startElection() {
  // If already leader → ignore
  if (state.getState() === "LEADER") return;

  state.setState("CANDIDATE");
  state.incrementTerm();
  state.voteFor(id);

  const currentTerm = state.getTerm();
  let votes = 1;

  console.log(`[${id}] Starting election for term ${currentTerm}`);

  for (let peer of peers) {
    // Skip self
    if (peer.endsWith(port)) continue;

    try {
      const res = await axios.post(`${peer}/request-vote`, {
        term: currentTerm,
        candidateId: id,
      });

      const { voteGranted, term } = res.data;

      // 🔥 If we see higher term → step down
      if (term > state.getTerm()) {
        state.setState("FOLLOWER");
        return;
      }

      if (voteGranted) votes++;
    } catch (err) {
      // Ignore network failures
    }
  }

  // Majority = 2 (in 3 nodes)
  if (votes >= 2 && state.getState() === "CANDIDATE") {
    becomeLeader();
  } else {
    resetElectionTimer();
  }
}

/**
 * BECOME LEADER
 */
function becomeLeader() {
  state.setState("LEADER");
  state.setLeader(id);

  console.log(`[${id}] Became LEADER`);

  // 🔥 CRITICAL: stop election timer
  stopElectionTimer();

  // Start heartbeat loop
  startHeartbeat(sendHeartbeat);
}

/**
 * SEND HEARTBEATS
 */
async function sendHeartbeat() {
  for (let peer of peers) {
    // Skip self
    if (peer.endsWith(port)) continue;

    try {
      await axios.post(`${peer}/heartbeat`, {
        term: state.getTerm(),
        leaderId: id,
      });
    } catch (err) {
      // Ignore failures
    }
  }
}

const log = require("./log");

async function replicateEntry(entry) {
  const index = log.appendEntry(entry);

  let successCount = 1; // leader counts itself

  for (let peer of peers) {
    if (peer.endsWith(port)) continue;

    try {
      const res = await axios.post(`${peer}/append-entries`, {
        term: state.getTerm(),
        leaderId: id,
        entry,
      });

      if (res.data.success) successCount++;
    } catch (err) {}
  }

  // Majority check
  if (successCount >= 2) {
    log.commit(index);
    console.log(`[${id}] Entry committed at index ${index}`);

    return true;
  }

  return false;
}

async function syncWithLeader(leaderUrl) {
  try {
    const res = await axios.get(`${leaderUrl}/sync-log`);

    const { log: leaderLog, term } = res.data;

    console.log(`[${id}] Syncing log from leader`);

    log.setLog(leaderLog);

    // Update term if needed
    if (term > state.getTerm()) {
      state.incrementTerm();
    }

  } catch (err) {
    console.log(`[${id}] Sync failed`);
  }
}

module.exports = {
  startRaft,
  startElection, // useful for debugging / future
  replicateEntry,
  syncWithLeader,
};