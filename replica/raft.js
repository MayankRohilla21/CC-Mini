const axios = require("axios");
const state = require("./state");
const log = require("./log");
const logger = require("./logger");
const {
  resetElectionTimer,
  startHeartbeat,
  stopElectionTimer,
  setElectionCallback,
} = require("./timers");

const peers = (process.env.PEERS || "http://localhost:5001,http://localhost:5002,http://localhost:5003")
  .split(",")
  .map((peer) => peer.trim())
  .filter(Boolean);

const id = process.env.ID || "node1";
const port = process.env.PORT;

function stepDownAndAdoptTerm(newTerm, leader = null) {
  state.setTerm(newTerm);
  state.setState("FOLLOWER");
  if (leader) state.setLeader(leader);
}

async function startRaft() {
  setElectionCallback(startElection);
  logger.info("RAFT_START", { peers });

  for (const peer of peers) {
    if (peer.endsWith(port)) continue;
    const synced = await syncWithLeader(peer, 0);
    if (synced) break;
  }

  resetElectionTimer();
}

async function startElection() {
  if (state.getState() === "LEADER") return;

  state.setState("CANDIDATE");
  state.incrementTerm();
  state.voteFor(id);

  const currentTerm = state.getTerm();
  let votes = 1;
  logger.info("ELECTION_STARTED", { term: currentTerm });

  for (const peer of peers) {
    if (peer.endsWith(port)) continue;

    try {
      const res = await axios.post(`${peer}/request-vote`, {
        term: currentTerm,
        candidateId: id,
      });

      const { voteGranted, term } = res.data;
      if (term > state.getTerm()) {
        stepDownAndAdoptTerm(term);
        logger.warn("ELECTION_ABORT_HIGHER_TERM", { peer, higherTerm: term });
        return;
      }
      if (voteGranted) votes++;
    } catch (err) {
      logger.warn("VOTE_RPC_FAILED", { peer, error: err.message });
    }
  }

  if (votes >= 2 && state.getState() === "CANDIDATE") {
    becomeLeader();
  } else {
    logger.info("ELECTION_RETRY", { term: currentTerm, votes });
    resetElectionTimer();
  }
}

function becomeLeader() {
  state.setState("LEADER");
  state.setLeader(id);
  logger.info("LEADER_ELECTED", { leader: id });
  stopElectionTimer();
  startHeartbeat(sendHeartbeat);
}

async function sendHeartbeat() {
  for (const peer of peers) {
    if (peer.endsWith(port)) continue;

    try {
      const res = await axios.post(`${peer}/heartbeat`, {
        term: state.getTerm(),
        leaderId: id,
      });
      if (res.data && res.data.term > state.getTerm()) {
        stepDownAndAdoptTerm(res.data.term);
        logger.warn("HEARTBEAT_HIGHER_TERM", { peer, higherTerm: res.data.term });
        return;
      }
    } catch (_err) {}
  }
}

async function replicateEntry(entry) {
  const index = log.appendEntry(entry, state.getTerm());
  const logEntry = log.getEntry(index);
  const prevLogIndex = index - 1;
  let successCount = 1;

  for (const peer of peers) {
    if (peer.endsWith(port)) continue;

    try {
      const res = await axios.post(`${peer}/append-entries`, {
        term: state.getTerm(),
        leaderId: id,
        prevLogIndex,
        entry: logEntry,
      });

      if (res.data.term > state.getTerm()) {
        stepDownAndAdoptTerm(res.data.term);
        logger.warn("STEPDOWN_DURING_REPLICATION", { peer, higherTerm: res.data.term });
        return { committed: false, entry: logEntry };
      }

      if (res.data.success) {
        successCount++;
        continue;
      }

      if (res.data.needSync) {
        const followerLastIndex = Number.isInteger(res.data.lastIndex) ? res.data.lastIndex : -1;
        await syncPeerFromIndex(peer, followerLastIndex + 1);
        const retry = await axios.post(`${peer}/append-entries`, {
          term: state.getTerm(),
          leaderId: id,
          prevLogIndex,
          entry: logEntry,
        });
        if (retry.data.success) successCount++;
      }
    } catch (err) {
      logger.warn("APPEND_RPC_FAILED", { peer, error: err.message });
    }
  }

  if (successCount >= 2) {
    log.commit(index);
    logger.info("ENTRY_COMMITTED", { index, successCount });
    return { committed: true, entry: log.getEntry(index) };
  }

  logger.warn("ENTRY_NOT_COMMITTED", { index, successCount });
  return { committed: false, entry: log.getEntry(index) };
}

async function syncPeerFromIndex(peer, fromIndex) {
  try {
    const entries = log.getEntriesFrom(fromIndex);
    await axios.post(`${peer}/install-entries`, {
      term: state.getTerm(),
      leaderId: id,
      entries,
      commitIndex: log.getCommitIndex(),
    });
    logger.info("FOLLOWER_SYNC_PUSHED", { peer, fromIndex, count: entries.length });
  } catch (err) {
    logger.warn("FOLLOWER_SYNC_FAILED", { peer, fromIndex, error: err.message });
  }
}

async function syncWithLeader(leaderUrl, fromIndex = 0) {
  try {
    const res = await axios.get(`${leaderUrl}/sync-log?from=${fromIndex}`);
    const { log: leaderLog, term, commitIndex } = res.data;
    if (!Array.isArray(leaderLog)) return false;

    if (fromIndex > 0) log.installEntries(leaderLog);
    else log.setLog(leaderLog);

    if (Number.isInteger(commitIndex) && commitIndex >= 0) {
      log.commit(commitIndex);
    }
    if (term > state.getTerm()) state.setTerm(term);

    logger.info("FOLLOWER_SYNCED", { leaderUrl, fromIndex, entries: leaderLog.length });
    return true;
  } catch (err) {
    logger.warn("FOLLOWER_SYNC_PULL_FAILED", { leaderUrl, fromIndex, error: err.message });
    return false;
  }
}

module.exports = {
  startRaft,
  startElection,
  replicateEntry,
  syncWithLeader,
};