const express = require("express");
const router = express.Router();

const state = require("./state");
const { resetElectionTimer } = require("./timers");
const { syncWithLeader } = require("./raft");
const log = require("./log");
const logger = require("./logger");

// GET LOG ENDPOINT
router.get("/log", (req, res) => {
  res.json(log.getLog());
});

/**
 * REQUEST VOTE RPC
 */
router.post("/request-vote", (req, res) => {
  const { term, candidateId } = req.body;
  logger.info("REQUEST_VOTE_RECEIVED", { candidateId, term });

  // Reject if term is stale
  if (term < state.getTerm()) {
    return res.json({
      voteGranted: false,
      term: state.getTerm(),
    });
  }

  // If term is higher → update term and convert to follower
  if (term > state.getTerm()) {
    state.setTerm(term);
    state.setState("FOLLOWER");
  }

  // Grant vote if not voted or same candidate
  if (!state.getVotedFor() || state.getVotedFor() === candidateId) {
    state.voteFor(candidateId);

    // Reset election timer since we heard from candidate
    resetElectionTimer();

    logger.info("VOTE_GRANTED", { candidateId, term: state.getTerm() });

    return res.json({
      voteGranted: true,
      term: state.getTerm(),
    });
  }

  // Already voted for someone else
  res.json({
    voteGranted: false,
    term: state.getTerm(),
  });
});

/**
 * HEARTBEAT RPC
 */
router.post("/heartbeat", (req, res) => {
  const { term, leaderId } = req.body;
  logger.info("HEARTBEAT_RECEIVED", { leaderId, term });

  // Ignore stale leader
  if (term < state.getTerm()) {
    return res.json({ term: state.getTerm() });
  }

  // If newer term → update
  if (term > state.getTerm()) {
    state.setTerm(term);
  }

  // 🔥 ONLY change state if needed
  if (state.getState() !== "FOLLOWER") {
    state.setState("FOLLOWER");
  }

  state.setLeader(leaderId);

  // Reset election timer
  resetElectionTimer();

  res.json({ term: state.getTerm() });
});

/**
 * LEADER DISCOVERY (for Gateway)
 */
router.get("/leader", (req, res) => {
  res.json({
    leader: state.getLeader(),
    term: state.getTerm(),
    state: state.getState(),
  });
});


router.post("/append-entries", (req, res) => {
  const { term, leaderId, prevLogIndex, entry } = req.body;
  logger.info("APPEND_ENTRIES_RECEIVED", { leaderId, term, prevLogIndex });

  // Reject stale leader
  if (term < state.getTerm()) {
    return res.json({ success: false, term: state.getTerm() });
  }

  if (term > state.getTerm()) {
    state.setTerm(term);
  }

  if (state.getState() !== "FOLLOWER") {
    state.setState("FOLLOWER");
  }

  state.setLeader(leaderId);

  if (Number.isInteger(prevLogIndex) && prevLogIndex > log.getLastIndex()) {
    logger.warn("APPEND_REJECT_NEEDS_SYNC", {
      leaderId,
      prevLogIndex,
      lastIndex: log.getLastIndex(),
    });
    return res.json({
      success: false,
      needSync: true,
      lastIndex: log.getLastIndex(),
      term: state.getTerm(),
    });
  }

  if (entry) {
    log.appendEntry(entry, term);
    logger.info("ENTRY_APPENDED", { index: entry.index });
  }

  // Reset timer
  resetElectionTimer();

  res.json({ success: true, term: state.getTerm() });
});

const { replicateEntry } = require("./raft");

router.post("/stroke", async (req, res) => {
  const entry = req.body;

  if (state.getState() !== "LEADER") {
    return res.status(400).json({
      error: "Not leader",
      leaderId: state.getLeader(),
      term: state.getTerm(),
    });
  }

  logger.info("STROKE_RECEIVED_FROM_GATEWAY");

  const result = await replicateEntry(entry);

  if (result.committed) {
    res.json({ success: true, entry: result.entry });
  } else {
    res.status(500).json({ success: false });
  }
});

router.get("/sync-log", (req, res) => {
  const from = parseInt(req.query.from || "0", 10);
  const startIndex = Number.isNaN(from) ? 0 : Math.max(0, from);
  const entries = log.getEntriesFrom(startIndex);
  logger.info("SYNC_LOG_REQUEST", { from: startIndex, count: entries.length });

  res.json({
    log: entries,
    term: state.getTerm(),
    commitIndex: log.getCommitIndex(),
  });
});

router.post("/install-entries", (req, res) => {
  const { term, leaderId, entries = [], commitIndex } = req.body;
  if (term < state.getTerm()) {
    return res.json({ success: false, term: state.getTerm() });
  }

  if (term > state.getTerm()) {
    state.setTerm(term);
  }

  state.setLeader(leaderId);
  state.setState("FOLLOWER");
  log.installEntries(entries);
  if (Number.isInteger(commitIndex) && commitIndex >= 0) {
    log.commit(commitIndex);
  }
  resetElectionTimer();
  logger.info("INSTALL_ENTRIES_RECEIVED", { leaderId, count: entries.length, commitIndex });
  res.json({ success: true, term: state.getTerm() });
});

router.post("/resync", async (req, res) => {
  const { leaderUrl, from = 0 } = req.body;
  if (!leaderUrl) {
    return res.status(400).json({ success: false, error: "leaderUrl required" });
  }

  const ok = await syncWithLeader(leaderUrl, from);
  res.json({ success: ok });
});

module.exports = router;